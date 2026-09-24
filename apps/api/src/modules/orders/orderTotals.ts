import { Schema, type Types } from 'mongoose';
import { ApiError } from '../../utils/apiError.js';

/**
 * Story 9.1 — fixed order totals block (FR-09.7).
 *
 * The embedded schema below is the single source of truth for the seven
 * totals fields every order stores. Checkout (Story 3.4) embeds
 * `orderTotalsSchema` on the order document and fills it exclusively with
 * `computeOrderTotals` output — client-supplied totals are never trusted.
 */

/** VND granted per redeemed loyalty point (FR-08.7). */
export const POINT_VALUE_VND = 10;

/** Epic 8 — redemption rules: multiples of 100 points, capped at 20% of subtotal. */
export const POINTS_REDEMPTION_STEP = 100;
export const POINTS_REDEMPTION_CAP_RATIO = 0.2;

/** Flat shipping fee charged when no tier free-shipping benefit applies. */
export const SHIPPING_FEE_VND = 30_000;

export const COUPON_DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const;
export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

/**
 * Immutable snapshot of the redeemed coupon and its rule at checkout time,
 * so later promotion edits never change historical orders (FR-09.9).
 * `couponId` stays resolvable for usage reporting after the coupon is
 * disabled or soft-deleted (FR-09.1b).
 */
export interface OrderCouponSnapshot {
  couponId: Types.ObjectId | string | null;
  /** Promotion rule behind the coupon at checkout (ERD field; additive). */
  promotionId: Types.ObjectId | string | null;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  couponRef: OrderCouponSnapshot | null;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  shippingFee: number;
  grandTotal: number;
}

const couponSnapshotSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', default: null },
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion', default: null },
    code: { type: String, required: true },
    discountType: { type: String, enum: COUPON_DISCOUNT_TYPES, required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

export const orderTotalsSchema = new Schema(
  {
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    couponRef: { type: couponSnapshotSchema, default: null },
    pointsRedeemed: { type: Number, required: true, min: 0, default: 0 },
    pointsDiscountAmount: { type: Number, required: true, min: 0, default: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    grandTotal: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

export interface OrderTotalsInput {
  /** Order lines with server-side line totals; subtotal is their sum. */
  lineItems: ReadonlyArray<{ lineTotal: number }>;
  /** VND removed by the applied coupon/promotion. Defaults to 0. */
  discountAmount?: number;
  /** Immutable coupon snapshot, or null when no coupon was redeemed. */
  couponRef?: OrderCouponSnapshot | null;
  /** Loyalty points spent on this order. Defaults to 0. */
  pointsRedeemed?: number;
  /** Shipping charged; 0 when a tier free-shipping benefit applies. */
  shippingFee?: number;
}

function toMoney(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw ApiError.badRequest(`Giá trị ${field} không hợp lệ`);
  }
  return Math.round(value);
}

/**
 * Computes the seven-field totals block server-side (FR-09.7a).
 * `grandTotal = subtotal - discountAmount - pointsDiscountAmount + shippingFee`,
 * clamped at 0 so it can never be negative (FR-09.7b).
 */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  if (!Array.isArray(input.lineItems)) {
    throw ApiError.badRequest('Đơn hàng phải có danh sách sản phẩm');
  }

  const subtotal = input.lineItems.reduce(
    (sum, item) => sum + toMoney(item.lineTotal, 'lineTotal'),
    0,
  );
  const discountAmount = toMoney(input.discountAmount ?? 0, 'discountAmount');
  const pointsRedeemed = toMoney(input.pointsRedeemed ?? 0, 'pointsRedeemed');
  const pointsDiscountAmount = pointsRedeemed * POINT_VALUE_VND;
  const shippingFee = toMoney(input.shippingFee ?? 0, 'shippingFee');

  const couponRef = input.couponRef ?? null;
  if (couponRef !== null) {
    if (
      !couponRef.code ||
      !COUPON_DISCOUNT_TYPES.includes(couponRef.discountType) ||
      !Number.isFinite(couponRef.discountValue) ||
      couponRef.discountValue < 0
    ) {
      throw ApiError.badRequest('Snapshot coupon không hợp lệ');
    }
  }

  const grandTotal = Math.max(
    0,
    subtotal - discountAmount - pointsDiscountAmount + shippingFee,
  );

  return {
    subtotal,
    discountAmount,
    couponRef: couponRef === null ? null : { ...couponRef },
    pointsRedeemed,
    pointsDiscountAmount,
    shippingFee,
    grandTotal,
  };
}
