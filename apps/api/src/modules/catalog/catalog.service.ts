import type { FilterQuery } from 'mongoose';
import { BrandModel } from '../../models/Brand.js';
import { CategoryModel } from '../../models/Category.js';
import { ProductModel, type Product } from '../../models/Product.js';
import { ApiError } from '../../utils/apiError.js';
import { buildPageMeta, type PageMeta } from '../../utils/pagination.js';
import { slugify } from '../../utils/slug.js';
import {
  toBrandDto,
  toCategoryDto,
  toProductDetailDto,
  toProductListItemDto,
  type BrandDto,
  type CategoryDto,
  type ProductDetailDto,
  type ProductListItemDto,
} from './catalog.dto.js';
import type { ProductListQuery, ProductSort } from './product.query.js';

const VISIBLE: FilterQuery<Product> = { isActive: true, isDeleted: false };

const SORT_SPECS: Record<ProductSort, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  price_asc: { effectivePrice: 1 },
  price_desc: { effectivePrice: -1 },
  popular: { soldCount: -1, ratingAverage: -1 },
};

export async function listCategories(): Promise<CategoryDto[]> {
  const categories = await CategoryModel.find({ isActive: true, isDeleted: false })
    .sort({ displayOrder: 1, name: 1 })
    .exec();
  return categories.map(toCategoryDto);
}

export async function listBrands(): Promise<BrandDto[]> {
  const brands = await BrandModel.find({ isActive: true, isDeleted: false })
    .sort({ displayOrder: 1, name: 1 })
    .exec();
  return brands.map(toBrandDto);
}

async function resolveCategoryIds(slugs: string[]): Promise<string[]> {
  const docs = await CategoryModel.find({ slug: { $in: slugs }, isDeleted: false }).select('_id').exec();
  return docs.map((doc) => String(doc._id));
}

async function resolveBrandIds(slugs: string[]): Promise<string[]> {
  const docs = await BrandModel.find({ slug: { $in: slugs }, isDeleted: false }).select('_id').exec();
  return docs.map((doc) => String(doc._id));
}

async function buildProductFilter(query: ProductListQuery): Promise<FilterQuery<Product>> {
  const filter: FilterQuery<Product> = { ...VISIBLE };

  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyword = new RegExp(escaped, 'i');
    const slugKeyword = new RegExp(slugify(query.q), 'i');
    filter.$or = [
      { name: keyword },
      { shortDescription: keyword },
      { slug: slugKeyword },
      { sku: keyword },
    ];
  }

  if (query.category?.length) {
    filter.category = { $in: await resolveCategoryIds(query.category) };
  }

  if (query.brand?.length) {
    filter.brand = { $in: await resolveBrandIds(query.brand) };
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const price: Record<string, number> = {};
    if (query.minPrice !== undefined) price.$gte = query.minPrice;
    if (query.maxPrice !== undefined) price.$lte = query.maxPrice;
    filter.effectivePrice = price;
  }

  if (query.availability === 'in_stock') {
    filter.availableStock = { $gt: 0 };
  } else if (query.availability === 'out_of_stock') {
    filter.availableStock = { $lte: 0 };
  }

  return filter;
}

export async function listProducts(
  query: ProductListQuery,
): Promise<{ items: ProductListItemDto[]; meta: PageMeta }> {
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
    throw ApiError.badRequest('minPrice không được lớn hơn maxPrice');
  }

  const filter = await buildProductFilter(query);
  const skip = (query.page - 1) * query.limit;

  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(SORT_SPECS[query.sort])
      .skip(skip)
      .limit(query.limit)
      .populate('category')
      .populate('brand')
      .exec(),
    ProductModel.countDocuments(filter).exec(),
  ]);

  return { items: products.map(toProductListItemDto), meta: buildPageMeta(query.page, query.limit, total) };
}

export async function getProductBySlug(slug: string): Promise<ProductDetailDto> {
  const product = await ProductModel.findOne({ slug: slug.toLowerCase(), ...VISIBLE })
    .populate('category')
    .populate('brand')
    .exec();

  if (!product) {
    throw ApiError.notFound('Không tìm thấy sản phẩm');
  }

  return toProductDetailDto(product);
}

export async function listRelatedProducts(slug: string, limit = 4): Promise<ProductListItemDto[]> {
  const product = await ProductModel.findOne({ slug: slug.toLowerCase(), ...VISIBLE }).exec();
  if (!product) {
    throw ApiError.notFound('Không tìm thấy sản phẩm');
  }

  const related = await ProductModel.find({
    ...VISIBLE,
    _id: { $ne: product._id },
    $or: [{ category: product.category }, { brand: product.brand }],
  })
    .sort({ soldCount: -1 })
    .limit(limit)
    .populate('category')
    .populate('brand')
    .exec();

  return related.map(toProductListItemDto);
}

export async function listFeaturedProducts(limit = 8): Promise<{
  bestSellers: ProductListItemDto[];
  newArrivals: ProductListItemDto[];
  onSale: ProductListItemDto[];
}> {
  const [bestSellers, newArrivals, onSale] = await Promise.all([
    ProductModel.find(VISIBLE).sort({ soldCount: -1 }).limit(limit).populate('category').populate('brand').exec(),
    ProductModel.find(VISIBLE).sort({ createdAt: -1 }).limit(limit).populate('category').populate('brand').exec(),
    ProductModel.find({ ...VISIBLE, $expr: { $lt: ['$effectivePrice', '$price'] } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('category')
      .populate('brand')
      .exec(),
  ]);

  return {
    bestSellers: bestSellers.map(toProductListItemDto),
    newArrivals: newArrivals.map(toProductListItemDto),
    onSale: onSale.map(toProductListItemDto),
  };
}
