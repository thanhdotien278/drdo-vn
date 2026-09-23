import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const LOYALTY_ENTRY_KINDS = ['accrual', 'redemption', 'adjustment', 'tier_change'] as const;
export type LoyaltyEntryKind = (typeof LOYALTY_ENTRY_KINDS)[number];

/**
 * Epic 8 — append-only loyalty ledger (FR-08). There is no mutable balance
 * counter anywhere: balance = Σ delta and lifetimeEarned = Σ max(0, delta),
 * both derived by aggregation. `balanceAfter` is a write-time audit snapshot
 * stored on each row, never a counter to update.
 *
 * The unique partial index on `orderId` for `kind='accrual'` is the DB
 * safeguard that makes per-order accrual exactly-once: a replayed shipment
 * hits duplicate-key 11000 and becomes a silent no-op.
 */
const loyaltyLedgerActorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    role: { type: String, default: null },
    label: { type: String, default: '' },
  },
  { _id: false },
);

const loyaltyLedgerEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: LOYALTY_ENTRY_KINDS, required: true, index: true },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    orderNo: { type: String, default: '', trim: true },
    reason: { type: String, default: '', trim: true, maxlength: 500 },
    actor: { type: loyaltyLedgerActorSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

loyaltyLedgerEntrySchema.index({ userId: 1, createdAt: -1 });
loyaltyLedgerEntrySchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { kind: 'accrual' } },
);

export type LoyaltyLedgerEntry = InferSchemaType<typeof loyaltyLedgerEntrySchema>;
export type LoyaltyLedgerEntryDocument = HydratedDocument<LoyaltyLedgerEntry>;
export const LoyaltyLedgerEntryModel = model('LoyaltyLedgerEntry', loyaltyLedgerEntrySchema);
