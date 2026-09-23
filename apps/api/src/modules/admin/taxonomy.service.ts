import { Types, type Model } from 'mongoose';
import { z } from 'zod';
import { BrandModel, type BrandDocument } from '../../models/Brand.js';
import { CategoryModel, type CategoryDocument } from '../../models/Category.js';
import { ProductModel } from '../../models/Product.js';
import { ApiError } from '../../utils/apiError.js';
import { slugify } from '../../utils/slug.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit, type AuditActorInput } from '../audit/audit.service.js';
import {
  toAdminBrandDto,
  toAdminCategoryDto,
  type AdminBrandDto,
  type AdminCategoryDto,
} from './admin.dto.js';

/**
 * Story 5.3 — category and brand management. Both taxonomies share the same
 * lifecycle (create / edit / activate / soft delete) and the same rule that
 * a taxonomy still referenced by a live product cannot be deleted
 * (FR-04.4): the product must be reassigned first, so nothing is orphaned.
 */

type TaxonomyKind = 'category' | 'brand';

interface TaxonomyConfig {
  kind: TaxonomyKind;
  model: Model<unknown>;
  entityLabel: string;
  inUseCode: string;
  productField: 'category' | 'brand';
  toDto: (doc: never) => unknown;
}

const CONFIGS: Record<TaxonomyKind, TaxonomyConfig> = {
  category: {
    kind: 'category',
    model: CategoryModel as Model<unknown>,
    entityLabel: 'danh mục',
    inUseCode: 'CATEGORY_IN_USE',
    productField: 'category',
    toDto: toAdminCategoryDto as (doc: never) => unknown,
  },
  brand: {
    kind: 'brand',
    model: BrandModel as Model<unknown>,
    entityLabel: 'thương hiệu',
    inUseCode: 'BRAND_IN_USE',
    productField: 'brand',
    toDto: toAdminBrandDto as (doc: never) => unknown,
  },
};

const baseFields = {
  name: z.string().trim().min(1, 'Vui lòng nhập tên').max(120),
  slug: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(2000).default(''),
  displayOrder: z.number().int().min(0).max(100_000).default(0),
  isActive: z.boolean().default(true),
};

const categoryCreateSchema = z.object({
  ...baseFields,
  imageUrl: z.string().trim().max(500).default(''),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

const brandCreateSchema = z.object({
  ...baseFields,
  logoUrl: z.string().trim().max(500).default(''),
  country: z.string().trim().max(120).default(''),
});

const brandUpdateSchema = brandCreateSchema.partial();

async function findTaxonomy(kind: TaxonomyKind, id: string): Promise<CategoryDocument | BrandDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest(`ID ${CONFIGS[kind].entityLabel} không hợp lệ`);
  }
  const doc = await CONFIGS[kind].model.findById(id).exec();
  if (!doc) {
    throw ApiError.notFound(`Không tìm thấy ${CONFIGS[kind].entityLabel}`);
  }
  return doc as CategoryDocument | BrandDocument;
}

async function assertUniqueSlug(kind: TaxonomyKind, slug: string, excludeId?: string): Promise<void> {
  const taken = await CONFIGS[kind].model.exists({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (taken) {
    throw new ApiError(409, 'SLUG_TAKEN', 'Slug đã được sử dụng');
  }
}

export async function listAdminCategories(): Promise<AdminCategoryDto[]> {
  const docs = await CategoryModel.find({}).sort({ displayOrder: 1, name: 1 }).exec();
  return docs.map(toAdminCategoryDto);
}

export async function listAdminBrands(): Promise<AdminBrandDto[]> {
  const docs = await BrandModel.find({}).sort({ displayOrder: 1, name: 1 }).exec();
  return docs.map(toAdminBrandDto);
}

export async function createAdminCategory(
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminCategoryDto> {
  const data = parseInput(categoryCreateSchema, input);
  const slug = slugify(data.slug ?? data.name);
  await assertUniqueSlug('category', slug);

  const doc = await CategoryModel.create({ ...data, slug });
  await recordAudit({
    actor,
    action: 'category.create',
    entityType: 'category',
    entityId: doc._id,
    nextValue: { name: doc.name, slug: doc.slug, isActive: doc.isActive },
  });
  return toAdminCategoryDto(doc);
}

export async function createAdminBrand(
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminBrandDto> {
  const data = parseInput(brandCreateSchema, input);
  const slug = slugify(data.slug ?? data.name);
  await assertUniqueSlug('brand', slug);

  const doc = await BrandModel.create({ ...data, slug });
  await recordAudit({
    actor,
    action: 'brand.create',
    entityType: 'brand',
    entityId: doc._id,
    nextValue: { name: doc.name, slug: doc.slug, isActive: doc.isActive },
  });
  return toAdminBrandDto(doc);
}

const TAXONOMY_FIELDS = [
  'name',
  'description',
  'displayOrder',
  'isActive',
  'imageUrl',
  'logoUrl',
  'country',
] as const;

async function updateTaxonomy(
  kind: TaxonomyKind,
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminCategoryDto | AdminBrandDto> {
  const config = CONFIGS[kind];
  const data = parseInput(
    kind === 'category' ? categoryUpdateSchema : brandUpdateSchema,
    input,
  );
  const doc = await findTaxonomy(kind, id);
  if (doc.isDeleted) {
    throw new ApiError(409, 'ALREADY_DELETED', `${config.entityLabel} đã bị xóa`);
  }

  const previousValue: Record<string, unknown> = {};
  const nextValue: Record<string, unknown> = {};

  for (const field of TAXONOMY_FIELDS) {
    const next = (data as Record<string, unknown>)[field];
    if (next === undefined) continue;
    const prev = (doc as unknown as Record<string, unknown>)[field];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      previousValue[field] = prev;
      nextValue[field] = next;
      (doc as unknown as Record<string, unknown>)[field] = next;
    }
  }

  if (data.slug !== undefined) {
    const slug = slugify(data.slug);
    if (slug !== doc.slug) {
      await assertUniqueSlug(kind, slug, String(doc._id));
      previousValue.slug = doc.slug;
      nextValue.slug = slug;
      doc.slug = slug;
    }
  }

  if (Object.keys(nextValue).length === 0) {
    return config.toDto(doc as never) as AdminCategoryDto | AdminBrandDto;
  }

  await doc.save();

  if (previousValue.isActive !== undefined) {
    await recordAudit({
      actor,
      action: `${kind}.status_change`,
      entityType: kind,
      entityId: doc._id,
      previousValue: { isActive: previousValue.isActive },
      nextValue: { isActive: nextValue.isActive },
    });
  }
  const prevRest = { ...previousValue };
  const nextRest = { ...nextValue };
  delete prevRest.isActive;
  delete nextRest.isActive;
  if (Object.keys(nextRest).length > 0) {
    await recordAudit({
      actor,
      action: `${kind}.update`,
      entityType: kind,
      entityId: doc._id,
      previousValue: prevRest,
      nextValue: nextRest,
    });
  }

  return config.toDto(doc as never) as AdminCategoryDto | AdminBrandDto;
}

async function deleteTaxonomy(
  kind: TaxonomyKind,
  id: string,
  actor: AuditActorInput,
): Promise<{ ok: true }> {
  const config = CONFIGS[kind];
  const doc = await findTaxonomy(kind, id);
  if (doc.isDeleted) {
    throw new ApiError(409, 'ALREADY_DELETED', `${config.entityLabel} đã bị xóa`);
  }

  const referencing = await ProductModel.countDocuments({
    [config.productField]: doc._id,
    isDeleted: false,
  }).exec();
  if (referencing > 0) {
    throw new ApiError(
      409,
      config.inUseCode,
      `Không thể xóa ${config.entityLabel} đang được ${referencing} sản phẩm sử dụng`,
      { products: referencing },
    );
  }

  await config.model
    .updateOne(
      { _id: doc._id },
      // Release the slug so a replacement taxonomy can reuse the name.
      { $set: { isDeleted: true, isActive: false, slug: `${doc.slug}--del-${Date.now()}` } },
    )
    .exec();

  await recordAudit({
    actor,
    action: `${kind}.delete`,
    entityType: kind,
    entityId: doc._id,
    previousValue: { isDeleted: false, name: doc.name, slug: doc.slug },
    nextValue: { isDeleted: true },
  });

  return { ok: true };
}

export function updateAdminCategory(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminCategoryDto | AdminBrandDto> {
  return updateTaxonomy('category', id, input, actor);
}

export function updateAdminBrand(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminCategoryDto | AdminBrandDto> {
  return updateTaxonomy('brand', id, input, actor);
}

export function deleteAdminCategory(id: string, actor: AuditActorInput): Promise<{ ok: true }> {
  return deleteTaxonomy('category', id, actor);
}

export function deleteAdminBrand(id: string, actor: AuditActorInput): Promise<{ ok: true }> {
  return deleteTaxonomy('brand', id, actor);
}
