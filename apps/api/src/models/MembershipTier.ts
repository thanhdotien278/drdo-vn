import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Epic 8 — membership tier configuration (FR-08). Seeded with
 * BRONZE/SILVER/GOLD/PLATINUM; admins may edit thresholds and multipliers.
 *
 * `freeShippingThreshold` semantics: `null` = no free-shipping benefit,
 * `0` = always free shipping, otherwise free when the discounted subtotal
 * (pre-redemption) reaches the threshold. `minLifetimePoints` is the
 * lifetime-earned points floor that unlocks the tier — tiers only move up.
 */
const membershipTierSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    minLifetimePoints: { type: Number, required: true, min: 0, default: 0 },
    earnMultiplier: { type: Number, required: true, min: 0, default: 1 },
    freeShippingThreshold: { type: Number, default: null, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

membershipTierSchema.index({ isActive: 1, minLifetimePoints: 1 });

export type MembershipTier = InferSchemaType<typeof membershipTierSchema>;
export type MembershipTierDocument = HydratedDocument<MembershipTier>;
export const MembershipTierModel = model('MembershipTier', membershipTierSchema);
