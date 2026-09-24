import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const COUPON_REDEMPTION_STATUSES = ['applied', 'released'] as const;
export type CouponRedemptionStatus = (typeof COUPON_REDEMPTION_STATUSES)[number];

/**
 * Epic 9 — one coupon redemption per order (ERD `COUPON_REDEMPTIONS`). The
 * unique `orderId` index is the DB safeguard for the one-coupon-per-order
 * rule. Usage limits count `applied` rows only: a pre-shipment cancellation
 * flips the row to `released` (claim-before-work, ADR-0011), freeing the
 * limit without deleting the audit trail. `code` is a snapshot so history
 * stays legible after the coupon is renamed or soft-deleted.
 */
const couponRedemptionSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    orderNo: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true, trim: true },
    discountAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: COUPON_REDEMPTION_STATUSES,
      required: true,
      default: 'applied',
      index: true,
    },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

couponRedemptionSchema.index({ couponId: 1, status: 1 });
couponRedemptionSchema.index({ userId: 1, createdAt: -1 });

export type CouponRedemption = InferSchemaType<typeof couponRedemptionSchema>;
export type CouponRedemptionDocument = HydratedDocument<CouponRedemption>;
export const CouponRedemptionModel = model('CouponRedemption', couponRedemptionSchema);
