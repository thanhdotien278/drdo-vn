import type { Types } from 'mongoose';
import type { BrandDocument } from '../../models/Brand.js';
import type { CategoryDocument } from '../../models/Category.js';
import type { ProductDocument } from '../../models/Product.js';

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  country: string;
}

export interface ProductListItemDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  discountPercent: number;
  images: { url: string; alt: string; isPrimary: boolean }[];
  category: CategoryDto | null;
  brand: BrandDto | null;
  availableStock: number;
  inStock: boolean;
  ratingAverage: number;
  ratingCount: number;
  volume: string;
}

export interface ProductDetailDto extends ProductListItemDto {
  description: string;
  ingredients: string;
  benefits: string[];
  usageInstructions: string;
  skinTypes: string[];
}

function isPopulated<T>(value: unknown): value is T {
  return typeof value === 'object' && value !== null && '_id' in (value as Record<string, unknown>) && 'name' in (value as Record<string, unknown>);
}

export function toCategoryDto(category: CategoryDocument): CategoryDto {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    imageUrl: category.imageUrl ?? '',
    displayOrder: category.displayOrder ?? 0,
  };
}

export function toBrandDto(brand: BrandDocument): BrandDto {
  return {
    id: String(brand._id),
    name: brand.name,
    slug: brand.slug,
    description: brand.description ?? '',
    logoUrl: brand.logoUrl ?? '',
    country: brand.country ?? '',
  };
}

function relation<TDoc, TDto>(
  value: Types.ObjectId | TDoc | null | undefined,
  map: (doc: TDoc) => TDto,
): TDto | null {
  return isPopulated<TDoc>(value) ? map(value) : null;
}

export function toProductListItemDto(product: ProductDocument): ProductListItemDto {
  const salePrice = typeof product.salePrice === 'number' ? product.salePrice : null;
  const effectivePrice = salePrice !== null && salePrice > 0 && salePrice < product.price ? salePrice : product.price;
  const availableStock = Math.max(0, product.stockOnHand - product.stockReserved);

  return {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription ?? '',
    price: product.price,
    salePrice,
    effectivePrice,
    discountPercent:
      effectivePrice < product.price ? Math.round(((product.price - effectivePrice) / product.price) * 100) : 0,
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? '',
      isPrimary: image.isPrimary ?? false,
    })),
    category: relation<CategoryDocument, CategoryDto>(product.category, toCategoryDto),
    brand: relation<BrandDocument, BrandDto>(product.brand, toBrandDto),
    availableStock,
    inStock: availableStock > 0,
    ratingAverage: product.ratingAverage ?? 0,
    ratingCount: product.ratingCount ?? 0,
    volume: product.volume ?? '',
  };
}

export function toProductDetailDto(product: ProductDocument): ProductDetailDto {
  return {
    ...toProductListItemDto(product),
    description: product.description ?? '',
    ingredients: product.ingredients ?? '',
    benefits: product.benefits ?? [],
    usageInstructions: product.usageInstructions ?? '',
    skinTypes: product.skinTypes ?? [],
  };
}
