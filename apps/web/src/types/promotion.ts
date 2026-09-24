export type DiscountType = 'percentage' | 'fixed_amount';

export interface AdminPromotion {
  id: string;
  name: string;
  discountType: DiscountType;
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

export interface AdminCoupon {
  id: string;
  code: string;
  promotionId: string;
  promotionName: string;
  usageLimitTotal: number | null;
  usageLimitPerCustomer: number | null;
  /** Count of `applied` redemptions — what usage limits compare against. */
  usageCount: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface CouponRedemption {
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
