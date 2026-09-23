import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import { z } from 'zod';
import { BrandModel } from '../../models/Brand.js';
import { CategoryModel } from '../../models/Category.js';
import { ProductModel, type ProductDocument } from '../../models/Product.js';
import { ApiError } from '../../utils/apiError.js';
import {
  buildPageMeta,
  paginationQuerySchema,
  skipForPage,
  type PageMeta,
} from '../../utils/pagination.js';
import { slugify } from '../../utils/slug.js';
import {
  ensureUploadsDir,
  publicUploadUrl,
  removeUploadFile,
  safeUploadFileName,
} from '../../utils/uploads.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit, type AuditActorInput } from '../audit/audit.service.js';
import { toAdminProductDto, type AdminProductDto } from './admin.dto.js';
import { MAX_PRODUCT_IMAGES } from './uploads.middleware.js';

/**
 * Story 5.2 — admin product management. Write paths go through the same
 * models as the storefront so `isActive`/`isDeleted` changes show up in
 * public browsing immediately (FR-03.6), and historical orders are never
 * touched — they resolve their own item snapshots.
 */

const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), { message: 'ID không hợp lệ' });

const moneyField = z.number().finite().min(0).max(1_000_000_000);
const stockField = z.number().int().min(0).max(1_000_000);
const stringList = z.array(z.string().trim().min(1).max(200)).max(30);

const productCreateSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên sản phẩm').max(200),
  slug: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().min(1, 'Vui lòng nhập SKU').max(64),
  shortDescription: z.string().trim().max(500).default(''),
  description: z.string().max(20_000).default(''),
  ingredients: z.string().max(20_000).default(''),
  benefits: stringList.max(30).default([]),
  usageInstructions: z.string().max(20_000).default(''),
  volume: z.string().trim().max(60).default(''),
  skinTypes: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  price: moneyField,
  salePrice: moneyField.nullable().optional(),
  stockOnHand: stockField.default(0),
  lowStockThreshold: z.number().int().min(0).max(100_000).default(5),
  category: objectIdSchema,
  brand: objectIdSchema,
  isActive: z.boolean().default(true),
});

const productUpdateSchema = productCreateSchema.partial();

const adminProductListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'active', 'inactive', 'deleted']).default('all'),
});

async function findProduct(id: string): Promise<ProductDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('ID sản phẩm không hợp lệ');
  }
  const product = await ProductModel.findById(id).populate('category').populate('brand').exec();
  if (!product) {
    throw ApiError.notFound('Không tìm thấy sản phẩm');
  }
  return product;
}

async function assertCategory(id: string): Promise<void> {
  const category = await CategoryModel.findOne({ _id: id, isDeleted: false }).select('_id').exec();
  if (!category) {
    throw new ApiError(400, 'INVALID_CATEGORY', 'Danh mục không hợp lệ');
  }
}

async function assertBrand(id: string): Promise<void> {
  const brand = await BrandModel.findOne({ _id: id, isDeleted: false }).select('_id').exec();
  if (!brand) {
    throw new ApiError(400, 'INVALID_BRAND', 'Thương hiệu không hợp lệ');
  }
}

async function assertUniqueSlug(slug: string, excludeId?: string): Promise<void> {
  const taken = await ProductModel.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  if (taken) {
    throw new ApiError(409, 'SLUG_TAKEN', 'Slug đã được sử dụng');
  }
}

async function assertUniqueSku(sku: string, excludeId?: string): Promise<void> {
  const taken = await ProductModel.exists({ sku, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
  if (taken) {
    throw new ApiError(409, 'SKU_TAKEN', 'SKU đã được sử dụng');
  }
}

export async function listAdminProducts(
  query: unknown,
): Promise<{ items: AdminProductDto[]; meta: PageMeta }> {
  const { page, limit, q, status } = parseInput(
    adminProductListQuerySchema,
    query,
    'Tham số truy vấn không hợp lệ',
  );

  const filter: Record<string, unknown> = {};
  if (status === 'active') {
    filter.isActive = true;
    filter.isDeleted = false;
  } else if (status === 'inactive') {
    filter.isActive = false;
    filter.isDeleted = false;
  } else if (status === 'deleted') {
    filter.isDeleted = true;
  }
  if (q) {
    const keyword = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: keyword }, { sku: keyword }, { slug: keyword }];
  }

  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .populate('category')
      .populate('brand')
      .exec(),
    ProductModel.countDocuments(filter).exec(),
  ]);

  return { items: products.map(toAdminProductDto), meta: buildPageMeta(page, limit, total) };
}

export async function getAdminProduct(id: string): Promise<AdminProductDto> {
  return toAdminProductDto(await findProduct(id));
}

export async function createAdminProduct(
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminProductDto> {
  const data = parseInput(productCreateSchema, input);
  const slug = slugify(data.slug ?? data.name);
  const sku = data.sku.toUpperCase();

  await Promise.all([
    assertUniqueSlug(slug),
    assertUniqueSku(sku),
    assertCategory(data.category),
    assertBrand(data.brand),
  ]);

  const product = await ProductModel.create({
    ...data,
    slug,
    sku,
    salePrice: data.salePrice ?? null,
    images: [],
  });

  await recordAudit({
    actor,
    action: 'product.create',
    entityType: 'product',
    entityId: product._id,
    nextValue: { name: product.name, slug: product.slug, sku: product.sku, price: product.price },
  });

  return getAdminProduct(String(product._id));
}

const UPDATABLE_FIELDS = [
  'name',
  'shortDescription',
  'description',
  'ingredients',
  'benefits',
  'usageInstructions',
  'volume',
  'skinTypes',
  'price',
  'salePrice',
  'stockOnHand',
  'lowStockThreshold',
  'isActive',
] as const;

export async function updateAdminProduct(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminProductDto> {
  const data = parseInput(productUpdateSchema, input);
  const product = await findProduct(id);
  if (product.isDeleted) {
    throw new ApiError(409, 'PRODUCT_DELETED', 'Sản phẩm đã bị xóa');
  }

  const previousValue: Record<string, unknown> = {};
  const nextValue: Record<string, unknown> = {};

  for (const field of UPDATABLE_FIELDS) {
    if (data[field] === undefined) continue;
    const next = data[field];
    const prev = product[field];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      previousValue[field] = prev;
      nextValue[field] = next;
    }
  }

  // Slug only changes when explicitly provided — renaming a product never
  // silently changes its storefront URL.
  if (data.slug !== undefined) {
    const slug = slugify(data.slug);
    if (slug !== product.slug) {
      await assertUniqueSlug(slug, String(product._id));
      previousValue.slug = product.slug;
      nextValue.slug = slug;
      product.slug = slug;
    }
  }
  if (data.sku !== undefined) {
    const sku = data.sku.toUpperCase();
    if (sku !== product.sku) {
      await assertUniqueSku(sku, String(product._id));
      previousValue.sku = product.sku;
      nextValue.sku = sku;
      product.sku = sku;
    }
  }
  if (data.category !== undefined && String(product.category?._id ?? product.category) !== data.category) {
    await assertCategory(data.category);
    previousValue.category = String(product.category?._id ?? product.category);
    nextValue.category = data.category;
    product.category = new Types.ObjectId(data.category);
  }
  if (data.brand !== undefined && String(product.brand?._id ?? product.brand) !== data.brand) {
    await assertBrand(data.brand);
    previousValue.brand = String(product.brand?._id ?? product.brand);
    nextValue.brand = data.brand;
    product.brand = new Types.ObjectId(data.brand);
  }

  for (const field of UPDATABLE_FIELDS) {
    if (data[field] !== undefined && field in nextValue) {
      (product as unknown as Record<string, unknown>)[field] = data[field];
    }
  }

  if (Object.keys(nextValue).length === 0) {
    return toAdminProductDto(product);
  }

  await product.save();

  const prevRest = { ...previousValue };
  const nextRest = { ...nextValue };
  delete prevRest.isActive;
  delete nextRest.isActive;

  if (previousValue.isActive !== undefined) {
    await recordAudit({
      actor,
      action: 'product.status_change',
      entityType: 'product',
      entityId: product._id,
      previousValue: { isActive: previousValue.isActive },
      nextValue: { isActive: nextValue.isActive },
    });
  }
  if (Object.keys(nextRest).length > 0) {
    await recordAudit({
      actor,
      action: 'product.update',
      entityType: 'product',
      entityId: product._id,
      previousValue: prevRest,
      nextValue: nextRest,
    });
  }

  return toAdminProductDto(await product.populate(['category', 'brand']));
}

export async function deleteAdminProduct(
  id: string,
  actor: AuditActorInput,
): Promise<AdminProductDto> {
  const product = await findProduct(id);
  if (product.isDeleted) {
    throw new ApiError(409, 'PRODUCT_DELETED', 'Sản phẩm đã bị xóa');
  }

  const suffix = Date.now();
  await ProductModel.updateOne(
    { _id: product._id },
    {
      $set: {
        isDeleted: true,
        isActive: false,
        // Release the unique namespace so a replacement product can reuse it.
        slug: `${product.slug}--del-${suffix}`,
        sku: `${product.sku}-DEL-${suffix}`,
      },
    },
  ).exec();

  await recordAudit({
    actor,
    action: 'product.delete',
    entityType: 'product',
    entityId: product._id,
    previousValue: { isDeleted: false, slug: product.slug, sku: product.sku },
    nextValue: { isDeleted: true },
  });

  return getAdminProduct(id);
}

// ---------- Images (FR-12.6-12.9) ----------

function imageFileName(imageUrl: string): string {
  return path.basename(imageUrl);
}

function findImageIndex(product: ProductDocument, imageId: string): number {
  return product.images.findIndex(
    (image) => imageFileName(image.url) === imageId && path.basename(imageId) === imageId,
  );
}

async function persistImage(file: Express.Multer.File): Promise<string> {
  const dir = await ensureUploadsDir('products');
  const fileName = safeUploadFileName(file.originalname);
  await writeFile(path.join(dir, fileName), file.buffer);
  return fileName;
}

export async function addProductImages(
  id: string,
  files: Express.Multer.File[] | undefined,
  alt: string | undefined,
  actor: AuditActorInput,
): Promise<AdminProductDto> {
  const product = await findProduct(id);
  if (product.isDeleted) {
    throw new ApiError(409, 'PRODUCT_DELETED', 'Sản phẩm đã bị xóa');
  }

  const uploads = files ?? [];
  if (uploads.length === 0) {
    throw new ApiError(400, 'INVALID_IMAGE_COUNT', 'Vui lòng chọn ít nhất một ảnh');
  }
  if (product.images.length + uploads.length > MAX_PRODUCT_IMAGES) {
    throw new ApiError(
      400,
      'IMAGE_LIMIT_EXCEEDED',
      `Sản phẩm chỉ hỗ trợ tối đa ${MAX_PRODUCT_IMAGES} ảnh`,
    );
  }

  const addedUrls: string[] = [];
  for (const file of uploads) {
    const fileName = await persistImage(file);
    const url = publicUploadUrl('products', fileName);
    addedUrls.push(url);
    product.images.push({
      url,
      alt: alt ?? product.name,
      isPrimary: product.images.length === 0,
    });
  }
  await product.save();

  await recordAudit({
    actor,
    action: 'product.image_add',
    entityType: 'product',
    entityId: product._id,
    nextValue: { added: addedUrls },
  });

  return toAdminProductDto(await product.populate(['category', 'brand']));
}

export async function replaceProductImage(
  id: string,
  imageId: string,
  file: Express.Multer.File | undefined,
  actor: AuditActorInput,
): Promise<AdminProductDto> {
  const product = await findProduct(id);
  const index = findImageIndex(product, imageId);
  if (index === -1) {
    throw ApiError.notFound('Không tìm thấy ảnh');
  }
  if (!file) {
    throw new ApiError(400, 'INVALID_IMAGE_COUNT', 'Vui lòng chọn một ảnh thay thế');
  }

  const previousUrl = product.images[index].url;
  const fileName = await persistImage(file);
  product.images[index].url = publicUploadUrl('products', fileName);
  await product.save();
  await removeUploadFile('products', imageFileName(previousUrl));

  await recordAudit({
    actor,
    action: 'product.image_replace',
    entityType: 'product',
    entityId: product._id,
    previousValue: { url: previousUrl },
    nextValue: { url: product.images[index].url },
  });

  return toAdminProductDto(await product.populate(['category', 'brand']));
}

export async function deleteProductImage(
  id: string,
  imageId: string,
  actor: AuditActorInput,
): Promise<AdminProductDto> {
  const product = await findProduct(id);
  const index = findImageIndex(product, imageId);
  if (index === -1) {
    throw ApiError.notFound('Không tìm thấy ảnh');
  }

  const [removed] = product.images.splice(index, 1);
  if (removed.isPrimary && product.images.length > 0) {
    product.images[0].isPrimary = true;
  }
  await product.save();
  await removeUploadFile('products', imageFileName(removed.url));

  await recordAudit({
    actor,
    action: 'product.image_remove',
    entityType: 'product',
    entityId: product._id,
    previousValue: { url: removed.url },
  });

  return toAdminProductDto(await product.populate(['category', 'brand']));
}
