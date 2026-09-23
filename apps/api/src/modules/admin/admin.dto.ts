import type { AuditLogDocument } from '../../models/AuditLog.js';
import type { BrandDocument } from '../../models/Brand.js';
import type { CategoryDocument } from '../../models/Category.js';
import type { OrderStatus } from '../../models/Order.js';
import type { ProductDocument } from '../../models/Product.js';
import type { UserDocument, UserRole, UserStatus } from '../../models/User.js';
import { toBrandDto, toCategoryDto, type BrandDto, type CategoryDto } from '../catalog/catalog.dto.js';

/**
 * Epic 5 — admin-facing DTOs. They reuse the catalog DTOs where the shape is
 * identical and add the operational fields (flags, stock, audit metadata)
 * that public endpoints deliberately hide.
 */

export interface AdminCategoryDto extends CategoryDto {
  isActive: boolean;
  isDeleted: boolean;
}

export interface AdminBrandDto extends BrandDto {
  displayOrder: number;
  isActive: boolean;
  isDeleted: boolean;
}

export interface AdminProductImageDto {
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface AdminProductDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  benefits: string[];
  usageInstructions: string;
  volume: string;
  skinTypes: string[];
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  images: AdminProductImageDto[];
  category: CategoryDto | null;
  brand: BrandDto | null;
  stockOnHand: number;
  stockReserved: number;
  availableStock: number;
  lowStockThreshold: number;
  soldCount: number;
  ratingAverage: number;
  ratingCount: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface AdminCustomerDto {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminStaffDto extends AdminCustomerDto {
  roles: UserRole[];
}

export interface AdminDashboardDto {
  /** Server-local day boundaries; week starts Monday 00:00 local time. */
  generatedAt: string;
  orders: {
    today: number;
    thisWeek: number;
    byStatus: Record<OrderStatus, number>;
  };
  revenue: {
    today: number;
    thisWeek: number;
  };
  lowStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
    stockOnHand: number;
    stockReserved: number;
    availableStock: number;
    lowStockThreshold: number;
  }>;
}

export interface AdminAuditLogDto {
  id: string;
  actor: { userId: string | null; role: string | null; label: string };
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  nextValue: unknown;
  note: string;
  createdAt: string;
}

export function toAdminCategoryDto(category: CategoryDocument): AdminCategoryDto {
  return {
    ...toCategoryDto(category),
    isActive: category.isActive,
    isDeleted: category.isDeleted,
  };
}

export function toAdminBrandDto(brand: BrandDocument): AdminBrandDto {
  return {
    ...toBrandDto(brand),
    displayOrder: brand.displayOrder ?? 0,
    isActive: brand.isActive,
    isDeleted: brand.isDeleted,
  };
}

function populated<TDoc, TDto>(
  value: unknown,
  map: (doc: TDoc) => TDto,
): TDto | null {
  return typeof value === 'object' && value !== null && '_id' in value && 'name' in value
    ? map(value as TDoc)
    : null;
}

export function toAdminProductDto(product: ProductDocument): AdminProductDto {
  const salePrice = typeof product.salePrice === 'number' ? product.salePrice : null;
  const effectivePrice =
    salePrice !== null && salePrice > 0 && salePrice < product.price ? salePrice : product.price;
  return {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    ingredients: product.ingredients ?? '',
    benefits: product.benefits ?? [],
    usageInstructions: product.usageInstructions ?? '',
    volume: product.volume ?? '',
    skinTypes: product.skinTypes ?? [],
    price: product.price,
    salePrice,
    effectivePrice,
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? '',
      isPrimary: image.isPrimary ?? false,
    })),
    category: populated<CategoryDocument, CategoryDto>(product.category, toCategoryDto),
    brand: populated<BrandDocument, BrandDto>(product.brand, toBrandDto),
    stockOnHand: product.stockOnHand,
    stockReserved: product.stockReserved,
    availableStock: Math.max(0, product.stockOnHand - product.stockReserved),
    lowStockThreshold: product.lowStockThreshold ?? 5,
    soldCount: product.soldCount ?? 0,
    ratingAverage: product.ratingAverage ?? 0,
    ratingCount: product.ratingCount ?? 0,
    isActive: product.isActive,
    isDeleted: product.isDeleted,
    createdAt: product.createdAt.toISOString(),
  };
}

export function toAdminCustomerDto(user: UserDocument): AdminCustomerDto {
  return {
    id: String(user._id),
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? '',
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

export function toAdminStaffDto(user: UserDocument): AdminStaffDto {
  return { ...toAdminCustomerDto(user), roles: user.roles };
}

export function toAdminAuditLogDto(entry: AuditLogDocument): AdminAuditLogDto {
  return {
    id: String(entry._id),
    actor: {
      userId: entry.actor?.userId ? String(entry.actor.userId) : null,
      role: entry.actor?.role ?? null,
      label: entry.actor?.label ?? '',
    },
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    previousValue: entry.previousValue ?? null,
    nextValue: entry.nextValue ?? null,
    note: entry.note ?? '',
    createdAt: entry.createdAt.toISOString(),
  };
}
