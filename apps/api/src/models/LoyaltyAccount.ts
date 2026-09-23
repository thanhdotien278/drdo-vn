import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Epic 8 — per-customer loyalty account. Holds ONLY the current tier code:
 * persisting it means admin threshold edits can never demote anyone
 * (upward-only recalculation compares tier ranks, not stored points).
 * Balance and lifetime-earned are always aggregated from the ledger —
 * this document must never grow a points counter.
 */
const loyaltyAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tierCode: { type: String, required: true, default: 'BRONZE', uppercase: true, trim: true },
  },
  { timestamps: true },
);

export type LoyaltyAccount = InferSchemaType<typeof loyaltyAccountSchema>;
export type LoyaltyAccountDocument = HydratedDocument<LoyaltyAccount>;
export const LoyaltyAccountModel = model('LoyaltyAccount', loyaltyAccountSchema);
