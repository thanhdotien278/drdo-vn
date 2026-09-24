import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Epic 9 — coupon code bound to a promotion (ERD `COUPONS`). `code` is
 * normalized to uppercase and unique, so `drdo10` and `DRDO10` resolve to
 * the same coupon. Soft delete appends a `--del-<ts>` suffix (taxonomy
 * pattern) to release the code for reuse; historical orders keep resolving
 * through the embedded `couponRef.couponId`, never through the live code.
 * `null` usage limits mean unlimited.
 */
const couponSchema = new Schema(
  {
    // No maxlength: soft delete appends `--del-<ts>` beyond the 50-char API limit.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion', required: true, index: true },
    usageLimitTotal: { type: Number, default: null, min: 1 },
    usageLimitPerCustomer: { type: Number, default: null, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

couponSchema.index({ isActive: 1, isDeleted: 1 });

export type Coupon = InferSchemaType<typeof couponSchema>;
export type CouponDocument = HydratedDocument<Coupon>;
export const CouponModel = model('Coupon', couponSchema);
