import { Types } from 'mongoose';
import { z } from 'zod';
import { AuditLogModel } from '../../models/AuditLog.js';
import {
  buildPageMeta,
  paginationQuerySchema,
  skipForPage,
  type PageMeta,
} from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { toAdminAuditLogDto, type AdminAuditLogDto } from './admin.dto.js';

const auditLogQuerySchema = paginationQuerySchema.extend({
  actorId: z
    .string()
    .refine((value) => Types.ObjectId.isValid(value), { message: 'actorId không hợp lệ' })
    .optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(120).optional(),
  action: z.string().trim().max(120).optional(),
});

/** Spec'd admin surface — read-only audit trail; reads are never audited. */
export async function listAdminAuditLogs(
  query: unknown,
): Promise<{ items: AdminAuditLogDto[]; meta: PageMeta }> {
  const { page, limit, actorId, entityType, entityId, action } = parseInput(
    auditLogQuerySchema,
    query,
    'Tham số truy vấn không hợp lệ',
  );

  const filter: Record<string, unknown> = {};
  if (actorId) filter['actor.userId'] = actorId;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (action) filter.action = action;

  const [entries, total] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .exec(),
    AuditLogModel.countDocuments(filter).exec(),
  ]);

  return { items: entries.map(toAdminAuditLogDto), meta: buildPageMeta(page, limit, total) };
}
