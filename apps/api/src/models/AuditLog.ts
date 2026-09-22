import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * Story 4.5 — audit logging foundation (FR-06).
 *
 * Append-only record of operational changes: order status, payment status,
 * catalog/category/brand, customer and staff management, and later review
 * moderation, banners, coupons, and loyalty adjustments.
 */

const auditActorSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    role: { type: String, default: null },
    label: { type: String, default: '' },
  },
  { _id: false },
);

const auditLogSchema = new Schema(
  {
    actor: { type: auditActorSchema, default: () => ({}) },
    action: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: String, required: true, trim: true },
    previousValue: { type: Schema.Types.Mixed, default: null },
    nextValue: { type: Schema.Types.Mixed, default: null },
    note: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ 'actor.userId': 1, createdAt: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogModel = model('AuditLog', auditLogSchema);
