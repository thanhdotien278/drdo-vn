import type { Types } from 'mongoose';
import type { CouponDocument } from '../../models/Coupon.js';
import type { CouponRedemptionDocument } from '../../models/CouponRedemption.js';
import type { PromotionDocument } from '../../models/Promotion.js';
import type { CouponDiscountType } from '../orders/orderTotals.js';

export interface AdminPromotionDto {
  id: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  startAt: string | null;
  endAt: string | null;
  minOrderTotal: number;
  productIds: string[];
  categoryIds: string[];
  brandIds: string[];
  tierCodes: string[];
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface AdminCouponDto {
  id: string;
  code: string;
  promotionId: string;
  promotionName: string;
  usageLimitTotal: number | null;
  usageLimitPerCustomer: number | null;
  /** Count of `applied` redemptions — the number usage limits compare against. */
  usageCount: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface CouponRedemptionDto {
  id: string;
  couponId: string;
  promotionId: string;
  orderId: string;
  orderNo: string;
  userId: string;
  code: string;
  discountAmount: number;
  status: 'applied' | 'released';
  releasedAt: string | null;
  createdAt: string;
}

const toIdStrings = (ids: Types.ObjectId[] | undefined | null): string[] =>
  (ids ?? []).map((id) => String(id));

export function toAdminPromotionDto(promotion: PromotionDocument): AdminPromotionDto {
  return {
    id: String(promotion._id),
    name: promotion.name,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    maxDiscountAmount: promotion.maxDiscountAmount ?? null,
    startAt: promotion.startAt ? promotion.startAt.toISOString() : null,
    endAt: promotion.endAt ? promotion.endAt.toISOString() : null,
    minOrderTotal: promotion.minOrderTotal ?? 0,
    productIds: toIdStrings(promotion.productIds),
    categoryIds: toIdStrings(promotion.categoryIds),
    brandIds: toIdStrings(promotion.brandIds),
    tierCodes: promotion.tierCodes ?? [],
    isActive: promotion.isActive,
    isDeleted: promotion.isDeleted,
    createdAt: promotion.createdAt.toISOString(),
  };
}

export function toAdminCouponDto(
  coupon: CouponDocument,
  usageCount: number,
  promotionName = '',
): AdminCouponDto {
  return {
    id: String(coupon._id),
    code: coupon.code,
    promotionId: String(coupon.promotionId),
    promotionName,
    usageLimitTotal: coupon.usageLimitTotal ?? null,
    usageLimitPerCustomer: coupon.usageLimitPerCustomer ?? null,
    usageCount,
    isActive: coupon.isActive,
    isDeleted: coupon.isDeleted,
    createdAt: coupon.createdAt.toISOString(),
  };
}

export function toCouponRedemptionDto(redemption: CouponRedemptionDocument): CouponRedemptionDto {
  return {
    id: String(redemption._id),
    couponId: String(redemption.couponId),
    promotionId: String(redemption.promotionId),
    orderId: String(redemption.orderId),
    orderNo: redemption.orderNo,
    userId: String(redemption.userId),
    code: redemption.code,
    discountAmount: redemption.discountAmount,
    status: redemption.status,
    releasedAt: redemption.releasedAt ? redemption.releasedAt.toISOString() : null,
    createdAt: redemption.createdAt.toISOString(),
  };
}
