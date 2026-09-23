import type { Types } from 'mongoose';
import { OrderItemModel } from '../../models/OrderItem.js';

/** Sum of item `qty` per order, keyed by the stringified order id. */
export async function countItemsByOrder(orderIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const counts = await OrderItemModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { orderId: { $in: orderIds } } },
    { $group: { _id: '$orderId', count: { $sum: '$qty' } } },
  ]).exec();
  return new Map(counts.map((entry) => [String(entry._id), entry.count]));
}
