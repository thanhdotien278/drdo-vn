import { Types } from 'mongoose';
import { z } from 'zod';
import { OrderItemModel } from '../../models/OrderItem.js';
import { OrderModel } from '../../models/Order.js';
import { USER_STATUSES, UserModel, type UserDocument } from '../../models/User.js';
import { ApiError } from '../../utils/apiError.js';
import {
  buildPageMeta,
  paginationQuerySchema,
  skipForPage,
  type PageMeta,
} from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit, type AuditActorInput } from '../audit/audit.service.js';
import { toOrderListItemDto, type OrderListItemDto } from '../orders/order.dto.js';
import { toAdminCustomerDto, type AdminCustomerDto } from './admin.dto.js';

/**
 * Story 5.4 — customer management (FR-14). Blocking flips `User.status`,
 * which the existing Epic 1 login guard and `requireAuth` reload enforce —
 * there is no second blocking mechanism.
 */

const customerListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(USER_STATUSES).optional(),
});

const customerStatusSchema = z.object({
  status: z.enum(['active', 'blocked']),
  note: z.string().trim().max(500).optional(),
});

export async function listAdminCustomers(
  query: unknown,
): Promise<{ items: AdminCustomerDto[]; meta: PageMeta }> {
  const { page, limit, q, status } = parseInput(
    customerListQuerySchema,
    query,
    'Tham số truy vấn không hợp lệ',
  );

  const filter: Record<string, unknown> = { roles: 'customer' };
  if (status) {
    filter.status = status;
  }
  if (q) {
    const keyword = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: keyword }, { email: keyword }, { phone: keyword }];
  }

  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .exec(),
    UserModel.countDocuments(filter).exec(),
  ]);

  return { items: users.map(toAdminCustomerDto), meta: buildPageMeta(page, limit, total) };
}

async function findCustomer(id: string): Promise<UserDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('ID khách hàng không hợp lệ');
  }
  const user = await UserModel.findById(id).exec();
  if (!user || !user.roles.includes('customer')) {
    throw ApiError.notFound('Không tìm thấy khách hàng');
  }
  return user;
}

export async function getAdminCustomer(
  id: string,
): Promise<{ customer: AdminCustomerDto; orders: OrderListItemDto[] }> {
  const user = await findCustomer(id);

  const orders = await OrderModel.find({ userId: user._id }).sort({ createdAt: -1 }).exec();
  const counts = await OrderItemModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { orderId: { $in: orders.map((order) => order._id) } } },
    { $group: { _id: '$orderId', count: { $sum: '$qty' } } },
  ]).exec();
  const countByOrder = new Map(counts.map((entry) => [String(entry._id), entry.count]));

  return {
    customer: toAdminCustomerDto(user),
    orders: orders.map((order) =>
      toOrderListItemDto(order, countByOrder.get(String(order._id)) ?? 0),
    ),
  };
}

export async function setAdminCustomerStatus(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminCustomerDto> {
  const data = parseInput(customerStatusSchema, input);
  const user = await findCustomer(id);

  if (user.status === data.status) {
    return toAdminCustomerDto(user);
  }

  const previousStatus = user.status;
  user.status = data.status;
  await user.save();

  await recordAudit({
    actor,
    action: 'customer.status_change',
    entityType: 'user',
    entityId: user._id,
    previousValue: { status: previousStatus },
    nextValue: { status: data.status },
    note: data.note,
  });

  return toAdminCustomerDto(user);
}
