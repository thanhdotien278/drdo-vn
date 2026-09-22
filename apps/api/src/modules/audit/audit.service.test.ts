import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditLogModel } from '../../models/AuditLog.js';
import { ApiError } from '../../utils/apiError.js';
import { recordAudit } from './audit.service.js';

test('recordAudit maps actor, action, entity, values and note onto the log entry', async (t) => {
  const createMock = t.mock.method(AuditLogModel, 'create', async (doc: unknown) => doc);

  await recordAudit({
    actor: { userId: '507f1f77bcf86cd799439011', role: 'employee', label: 'Nhân viên A' },
    action: 'order.status_change',
    entityType: 'order',
    entityId: '64b000000000000000000001',
    previousValue: 'pending',
    nextValue: 'processing',
    note: '  xác nhận kho  ',
  });

  assert.equal(createMock.mock.calls.length, 1);
  const doc = createMock.mock.calls[0].arguments[0] as Record<string, unknown>;
  assert.deepEqual(doc.actor, {
    userId: '507f1f77bcf86cd799439011',
    role: 'employee',
    label: 'Nhân viên A',
  });
  assert.equal(doc.action, 'order.status_change');
  assert.equal(doc.entityType, 'order');
  assert.equal(doc.entityId, '64b000000000000000000001');
  assert.equal(doc.previousValue, 'pending');
  assert.equal(doc.nextValue, 'processing');
  assert.equal(doc.note, 'xác nhận kho');
});

test('recordAudit defaults missing actor, values and note without failing', async (t) => {
  const createMock = t.mock.method(AuditLogModel, 'create', async (doc: unknown) => doc);

  await recordAudit({
    action: 'order.payment_status_change',
    entityType: 'order',
    entityId: '64b000000000000000000002',
    nextValue: 'paid',
  });

  const doc = createMock.mock.calls[0].arguments[0] as Record<string, unknown>;
  assert.deepEqual(doc.actor, { userId: null, role: null, label: '' });
  assert.equal(doc.previousValue, null);
  assert.equal(doc.note, '');
});

test('recordAudit rejects entries missing required fields', async () => {
  await assert.rejects(
    recordAudit({ action: '', entityType: 'order', entityId: 'x' }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
  await assert.rejects(
    recordAudit({ action: 'order.status_change', entityType: 'order', entityId: '  ' }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});

test('recordAudit propagates persistence failures so entries are not lost silently', async (t) => {
  t.mock.method(AuditLogModel, 'create', async () => {
    throw new Error('db down');
  });

  await assert.rejects(
    recordAudit({ action: 'product.update', entityType: 'product', entityId: 'p1' }),
    /db down/,
  );
});
