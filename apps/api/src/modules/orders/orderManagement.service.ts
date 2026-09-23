import { z } from 'zod';
import {
  ORDER_STATUSES,
  OrderModel,
  PAYMENT_STATUSES,
  type OrderStatus,
} from '../../models/Order.js';
import { OrderItemModel } from '../../models/OrderItem.js';
import { OrderStatusEventModel } from '../../models/OrderStatusEvent.js';
import { UserModel } from '../../models/User.js';
import type { UserRole } from '../../models/User.js';
import { ApiError } from '../../utils/apiError.js';
import { buildPageMeta, paginationQuerySchema, skipForPage } from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit, type AuditActorInput } from '../audit/audit.service.js';
import { consumeOrderReservation, releaseOrderReservation } from './inventory.js';
import { countItemsByOrder } from './orderItemCounts.js';
import {
  toStaffOrderDetailDto,
  toStaffOrderListItemDto,
  type StaffOrderDetailDto,
  type StaffOrderListItemDto,
} from './order.dto.js';

/**
 * Epic 4 — shared order operations for staff. Employees reach these through
 * `/employee/orders`; Epic 5 mounts the same handlers under `/admin/orders`,
 * so transition and payment rules cannot diverge between roles (FR-13.3).
 */

export interface StaffActor extends AuditActorInput {
  userId: string;
  role: UserRole;
}

/** FR-07.2/07.3 — the only legal moves; anything absent is rejected. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const staffOrderListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

const paymentUpdateSchema = z.object({
  paymentStatus: z.enum(PAYMENT_STATUSES),
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

async function findOrderByNo(orderNo: string) {
  const order = await OrderModel.findOne({ orderNo: orderNo.toUpperCase() }).exec();
  if (!order) {
    throw ApiError.notFound('Không tìm thấy đơn hàng');
  }
  return order;
}

/** Story 4.1 — all orders for fulfillment, newest first, filterable by status. */
export async function listOrdersForStaff(
  query: unknown,
): Promise<{ items: StaffOrderListItemDto[]; meta: ReturnType<typeof buildPageMeta> }> {
  const { page, limit, status } = parseInput(
    staffOrderListQuerySchema,
    query,
    'Tham số truy vấn không hợp lệ',
  );
  const filter = status ? { orderStatus: status } : {};
  const [orders, total] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip(skipForPage(page, limit)).limit(limit).exec(),
    OrderModel.countDocuments(filter).exec(),
  ]);

  const countByOrder = await countItemsByOrder(orders.map((order) => order._id));

  return {
    items: orders.map((order) =>
      toStaffOrderListItemDto(order, countByOrder.get(String(order._id)) ?? 0),
    ),
    meta: buildPageMeta(page, limit, total),
  };
}

/** Story 4.1 — any order detail plus the customer account behind it. */
export async function getOrderForStaff(orderNo: string): Promise<StaffOrderDetailDto> {
  const order = await findOrderByNo(orderNo);
  const [items, events, customer] = await Promise.all([
    OrderItemModel.find({ orderId: order._id }).sort({ createdAt: 1 }).exec(),
    OrderStatusEventModel.find({ orderId: order._id }).sort({ createdAt: 1 }).exec(),
    UserModel.findById(order.userId).exec(),
  ]);
  return toStaffOrderDetailDto(order, items, events, customer);
}

/**
 * Story 4.2 — the single order state machine. The conditional update on the
 * current status is the decision point: only one concurrent request can move
 * the order, so an invalid or lost race can never touch inventory. Only after
 * the status flips does the Epic 3 reservation marker apply its side effect
 * (`reserved -> deducted` on ship, `reserved -> released` on cancel), which is
 * itself a claim-before-work update — a crash under-applies, never doubles.
 */
export async function transitionOrderStatus(
  orderNo: string,
  input: unknown,
  actor: StaffActor,
): Promise<StaffOrderDetailDto> {
  const data = parseInput(statusUpdateSchema, input);
  const reason = data.reason ?? data.note ?? '';
  const order = await findOrderByNo(orderNo);

  const fromStatus = order.orderStatus;
  const toStatus = data.status;
  if (!ORDER_STATUS_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new ApiError(400, 'INVALID_STATUS_TRANSITION', 'Không thể chuyển trạng thái đơn hàng', {
      fromStatus,
      toStatus,
    });
  }

  const moved = await OrderModel.updateOne(
    { _id: order._id, orderStatus: fromStatus },
    { $set: { orderStatus: toStatus } },
  ).exec();
  if (moved.modifiedCount !== 1) {
    throw new ApiError(409, 'ORDER_STATE_CHANGED', 'Đơn hàng vừa được cập nhật bởi người khác', {
      fromStatus,
      toStatus,
    });
  }

  if (toStatus === 'shipped') {
    await consumeOrderReservation(order._id);
  } else if (toStatus === 'cancelled') {
    await releaseOrderReservation(order._id);
  }

  await OrderStatusEventModel.create({
    orderId: order._id,
    fromStatus,
    toStatus,
    changedBy: actor.userId,
    reason,
  });
  await recordAudit({
    actor,
    action: 'order.status_change',
    entityType: 'order',
    entityId: order._id,
    previousValue: { orderStatus: fromStatus },
    nextValue: { orderStatus: toStatus },
    note: reason,
  });

  return getOrderForStaff(orderNo);
}

/**
 * Story 4.4 — manual payment correction after offline verification. Setting
 * the current value is a safe no-op (no audit noise); real changes are claimed
 * conditionally, set/clear `paidAt`, and always write an audit entry.
 */
export async function updateOrderPaymentStatus(
  orderNo: string,
  input: unknown,
  actor: StaffActor,
): Promise<StaffOrderDetailDto> {
  const data = parseInput(paymentUpdateSchema, input);
  const note = data.reason ?? data.note ?? '';
  const order = await findOrderByNo(orderNo);

  const fromStatus = order.paymentStatus;
  const toStatus = data.paymentStatus;
  if (fromStatus === toStatus) {
    return getOrderForStaff(orderNo);
  }

  const paidAt = toStatus === 'paid' ? new Date() : null;
  const moved = await OrderModel.updateOne(
    { _id: order._id, paymentStatus: fromStatus },
    { $set: { paymentStatus: toStatus, paidAt } },
  ).exec();
  if (moved.modifiedCount !== 1) {
    throw new ApiError(409, 'ORDER_STATE_CHANGED', 'Đơn hàng vừa được cập nhật bởi người khác', {
      fromStatus,
      toStatus,
    });
  }

  await recordAudit({
    actor,
    action: 'order.payment_status_change',
    entityType: 'order',
    entityId: order._id,
    previousValue: { paymentStatus: fromStatus, paidAt: order.paidAt },
    nextValue: { paymentStatus: toStatus, paidAt },
    note,
  });

  return getOrderForStaff(orderNo);
}
