import type { Types } from 'mongoose';
import { AuditLogModel, type AuditLogDocument } from '../../models/AuditLog.js';
import { ApiError } from '../../utils/apiError.js';

/**
 * Audit entry points used by later epics:
 * - order status changes:        entityType 'order', action 'order.status_change'
 * - payment status changes:      entityType 'order', action 'order.payment_status_change'
 * - catalog/admin operations:    entityType 'product' | 'category' | 'brand' | 'user' | ...
 * - moderation/loyalty (future): entityType 'review' | 'banner' | 'coupon' | 'loyalty'
 */

export interface AuditActorInput {
  userId?: Types.ObjectId | string | null;
  role?: string | null;
  /** Human-readable snapshot (name/email) so the log stays legible after user edits. */
  label?: string | null;
}

export interface AuditEntryInput {
  actor?: AuditActorInput | null;
  action: string;
  entityType: string;
  entityId: Types.ObjectId | string;
  previousValue?: unknown;
  nextValue?: unknown;
  note?: string;
}

/**
 * Writes one audit record. Throws on validation or persistence failure —
 * audit logging is required (FR-06.1), so callers must not lose entries
 * silently; they should write the log inside the same flow/transaction as
 * the audited change.
 */
export async function recordAudit(entry: AuditEntryInput): Promise<AuditLogDocument> {
  const action = entry.action?.trim();
  const entityType = entry.entityType?.trim();
  const entityId = entry.entityId == null ? '' : String(entry.entityId).trim();

  if (!action || !entityType || !entityId) {
    throw ApiError.badRequest('Bản ghi audit thiếu action, entityType hoặc entityId');
  }

  const actor = entry.actor ?? null;

  return AuditLogModel.create({
    actor: {
      userId: actor?.userId ?? null,
      role: actor?.role ?? null,
      label: actor?.label?.trim() ?? '',
    },
    action,
    entityType,
    entityId,
    previousValue: entry.previousValue ?? null,
    nextValue: entry.nextValue ?? null,
    note: entry.note?.trim() ?? '',
  });
}
