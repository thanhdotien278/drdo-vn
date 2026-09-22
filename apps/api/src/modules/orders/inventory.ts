import type { Types } from 'mongoose';
import { OrderItemModel } from '../../models/OrderItem.js';
import { OrderModel } from '../../models/Order.js';
import { ProductModel } from '../../models/Product.js';
import { ApiError } from '../../utils/apiError.js';

/**
 * Story 3.6 — inventory reservation without multi-document transactions
 * (ADR-0011). Reservation is a single atomic conditional update per product:
 * `availableStock >= qty` guards the decrement so available stock can never
 * go negative, and `stockReserved`/`availableStock` move together because
 * `$inc` updates bypass the model's `pre('validate')` sync.
 */

/** Atomically reserves `qty` units; returns false when stock/active state fails. */
export async function reserveStock(productId: Types.ObjectId | string, qty: number): Promise<boolean> {
  const result = await ProductModel.updateOne(
    {
      _id: productId,
      isActive: true,
      isDeleted: false,
      availableStock: { $gte: qty },
    },
    { $inc: { stockReserved: qty, availableStock: -qty } },
  ).exec();
  return result.modifiedCount === 1;
}

/** Releases a reservation made by `reserveStock` (compensation/cancellation). */
export async function releaseStock(productId: Types.ObjectId | string, qty: number): Promise<void> {
  await ProductModel.updateOne(
    { _id: productId },
    { $inc: { stockReserved: -qty, availableStock: qty } },
  ).exec();
}

/**
 * Pre-shipment cancellation release (FR-08.3). The `inventoryState`
 * exactly-once marker is claimed first so a double-release is a no-op.
 * Shipment deduction (Epic 4 / Story 4.3) claims `reserved -> deducted`
 * the same way. Returns false when the reservation was already consumed.
 */
export async function releaseOrderReservation(orderId: Types.ObjectId | string): Promise<boolean> {
  const claimed = await OrderModel.updateOne(
    { _id: orderId, inventoryState: 'reserved' },
    { $set: { inventoryState: 'released' } },
  ).exec();
  if (claimed.modifiedCount !== 1) {
    return false;
  }

  const items = await OrderItemModel.find({ orderId }).exec();
  for (const item of items) {
    await releaseStock(item.productId, item.qty);
  }
  return true;
}

/**
 * Shipment deduction (Story 4.3). Claims `reserved -> deducted` exactly once,
 * then moves each line's qty from `stockReserved` out of `stockOnHand`.
 * `availableStock` (onHand - reserved) is untouched: both sides of the
 * derivation drop together so the stored value stays consistent. The per-line
 * `$gte` guards keep stock from ever going negative. Returns false when the
 * reservation was already consumed/released — a replayed shipment is a no-op.
 */
export async function consumeOrderReservation(orderId: Types.ObjectId | string): Promise<boolean> {
  const claimed = await OrderModel.updateOne(
    { _id: orderId, inventoryState: 'reserved' },
    { $set: { inventoryState: 'deducted' } },
  ).exec();
  if (claimed.modifiedCount !== 1) {
    return false;
  }

  const items = await OrderItemModel.find({ orderId }).exec();
  for (const item of items) {
    const deducted = await ProductModel.updateOne(
      {
        _id: item.productId,
        stockOnHand: { $gte: item.qty },
        stockReserved: { $gte: item.qty },
      },
      { $inc: { stockOnHand: -item.qty, stockReserved: -item.qty } },
    ).exec();
    if (deducted.modifiedCount !== 1) {
      throw new ApiError(409, 'INVENTORY_CONFLICT', 'Tồn kho không đủ để trừ khi giao hàng', {
        productId: String(item.productId),
        orderId: String(orderId),
      });
    }
  }
  return true;
}
