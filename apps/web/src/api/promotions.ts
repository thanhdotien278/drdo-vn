import type { PageMeta } from '../types/catalog';
import type { AdminCoupon, AdminPromotion, CouponRedemption, DiscountType } from '../types/promotion';
import { apiGet, apiRequest } from './client';

/** Epic 9 — admin promotion/coupon management clients. */

export type AdminStatusFilter = 'all' | 'active' | 'inactive' | 'deleted';

export interface PromotionFormFields {
  name?: string;
  discountType?: DiscountType;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  minOrderTotal?: number;
  productIds?: string[];
  categoryIds?: string[];
  brandIds?: string[];
  tierCodes?: string[];
  isActive?: boolean;
}

export interface CouponFormFields {
  code?: string;
  promotionId?: string;
  usageLimitTotal?: number | null;
  usageLimitPerCustomer?: number | null;
  isActive?: boolean;
}

export async function fetchAdminPromotions(
  query: { status?: AdminStatusFilter; page?: number; limit?: number } = {},
): Promise<{ items: AdminPromotion[]; meta: PageMeta }> {
  const result = await apiGet<AdminPromotion[]>('/admin/promotions', {
    status: query.status ?? 'all',
    page: query.page,
    limit: query.limit ?? 12,
  });
  return { items: result.data, meta: result.meta as PageMeta };
}

export function createAdminPromotion(
  fields: PromotionFormFields,
): Promise<{ data: AdminPromotion }> {
  return apiRequest<AdminPromotion>('POST', '/admin/promotions', { body: fields });
}

export function updateAdminPromotion(
  id: string,
  fields: PromotionFormFields,
): Promise<{ data: AdminPromotion }> {
  return apiRequest<AdminPromotion>('PATCH', `/admin/promotions/${encodeURIComponent(id)}`, {
    body: fields,
  });
}

export function deleteAdminPromotion(id: string): Promise<{ data: AdminPromotion }> {
  return apiRequest<AdminPromotion>('DELETE', `/admin/promotions/${encodeURIComponent(id)}`);
}

export async function fetchAdminCoupons(
  query: { status?: AdminStatusFilter; page?: number; promotionId?: string } = {},
): Promise<{ items: AdminCoupon[]; meta: PageMeta }> {
  const result = await apiGet<AdminCoupon[]>('/admin/coupons', {
    status: query.status ?? 'all',
    page: query.page,
    limit: 12,
    promotionId: query.promotionId,
  });
  return { items: result.data, meta: result.meta as PageMeta };
}

export function createAdminCoupon(fields: CouponFormFields): Promise<{ data: AdminCoupon }> {
  return apiRequest<AdminCoupon>('POST', '/admin/coupons', { body: fields });
}

export function updateAdminCoupon(
  id: string,
  fields: CouponFormFields,
): Promise<{ data: AdminCoupon }> {
  return apiRequest<AdminCoupon>('PATCH', `/admin/coupons/${encodeURIComponent(id)}`, {
    body: fields,
  });
}

export function deleteAdminCoupon(id: string): Promise<{ data: AdminCoupon }> {
  return apiRequest<AdminCoupon>('DELETE', `/admin/coupons/${encodeURIComponent(id)}`);
}

export async function fetchCouponRedemptions(
  couponId: string,
  page = 1,
): Promise<{ items: CouponRedemption[]; meta: PageMeta }> {
  const result = await apiGet<CouponRedemption[]>(
    `/admin/coupons/${encodeURIComponent(couponId)}/redemptions`,
    { page, limit: 10 },
  );
  return { items: result.data, meta: result.meta as PageMeta };
}
