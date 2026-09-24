import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { COUPON_DISCOUNT_TYPES } from '../modules/orders/orderTotals.js';

/**
 * Epic 9 — promotion rule behind one or more coupons (ERD `PROMOTIONS`).
 * The scope arrays (`productIds`/`categoryIds`/`brandIds`) define the
 * discount BASE: when any are set, only matching cart lines count; all empty
 * means the discount applies to the whole subtotal. `tierCodes` empty means
 * every tier may redeem. `startAt`/`endAt` are nullable for open-ended
 * windows. Orders never reference this document directly — they embed the
 * immutable `couponRef` snapshot, so later edits cannot rewrite history.
 */
const promotionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    discountType: { type: String, enum: COUPON_DISCOUNT_TYPES, required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    minOrderTotal: { type: Number, required: true, default: 0, min: 0 },
    productIds: { type: [Schema.Types.ObjectId], ref: 'Product', default: [] },
    categoryIds: { type: [Schema.Types.ObjectId], ref: 'Category', default: [] },
    brandIds: { type: [Schema.Types.ObjectId], ref: 'Brand', default: [] },
    tierCodes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

promotionSchema.index({ isActive: 1, isDeleted: 1 });

export type Promotion = InferSchemaType<typeof promotionSchema>;
export type PromotionDocument = HydratedDocument<Promotion>;
export const PromotionModel = model('Promotion', promotionSchema);
