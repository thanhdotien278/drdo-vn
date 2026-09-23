import { Types } from 'mongoose';
import { z } from 'zod';
import { AddressModel } from '../../models/Address.js';
import { CartItemModel } from '../../models/CartItem.js';
import { OrderItemModel } from '../../models/OrderItem.js';
import {
  OrderModel,
  PAYMENT_METHODS,
  type OrderDocument,
} from '../../models/Order.js';
import { OrderStatusEventModel } from '../../models/OrderStatusEvent.js';
import { ProductModel, type ProductDocument } from '../../models/Product.js';
import type { UserDto } from '../auth/auth.dto.js';
import { ApiError } from '../../utils/apiError.js';
import { buildPageMeta, paginationQuerySchema, skipForPage } from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit } from '../audit/audit.service.js';
import { loadCartItems } from '../cart/cart.service.js';
import { releaseStock, reserveStock } from './inventory.js';
import {
  toOrderDetailDto,
  toOrderListItemDto,
  type OrderDetailDto,
  type OrderListItemDto,
} from './order.dto.js';
import { countItemsByOrder } from './orderItemCounts.js';
import { computeOrderTotals, type OrderTotals } from './orderTotals.js';

/**
 * Flat shipping fee until Epic 8 tier free-shipping lands; stays a constant
 * so the totals block always comes from `computeOrderTotals`, never the client.
 */
export const SHIPPING_FEE_VND = 30_000;

const MAX_ORDER_NO_ATTEMPTS = 5;

const shippingFieldsSchema = z.object({
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên người nhận').max(120),
  phone: z.string().trim().min(8, 'Số điện thoại không hợp lệ').max(20),
  line1: z.string().trim().min(1, 'Vui lòng nhập địa chỉ').max(200),
  line2: z.string().trim().max(200).optional().default(''),
  ward: z.string().trim().min(1, 'Vui lòng nhập phường/xã').max(120),
  district: z.string().trim().min(1, 'Vui lòng nhập quận/huyện').max(120),
  province: z.string().trim().min(1, 'Vui lòng nhập tỉnh/thành phố').max(120),
});

const checkoutSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  addressId: z.string().trim().min(1).optional(),
  shipping: shippingFieldsSchema.optional(),
  contactEmail: z.string().trim().toLowerCase().email('Email không hợp lệ').max(254).optional(),
  notesCustomer: z.string().trim().max(500).optional().default(''),
});

const orderListQuerySchema = paginationQuerySchema;

interface ShippingSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  ward: string;
  district: string;
  province: string;
  contactEmail: string;
}

interface OrderLine {
  productId: Types.ObjectId;
  nameSnapshot: string;
  skuSnapshot: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

function generateOrderNo(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DRD-${stamp}-${rand}`;
}

async function resolveShipping(
  user: UserDto,
  data: z.infer<typeof checkoutSchema>,
): Promise<ShippingSnapshot> {
  const contactEmail = data.contactEmail ?? user.email;

  if (data.addressId) {
    // Saved address is read through the ownership filter — customers can
    // never snapshot someone else's address (FR-09.5).
    if (!Types.ObjectId.isValid(data.addressId)) {
      throw ApiError.notFound('Không tìm thấy địa chỉ đã lưu');
    }
    const address = await AddressModel.findOne({ _id: data.addressId, userId: user.id }).exec();
    if (!address) {
      throw ApiError.notFound('Không tìm thấy địa chỉ đã lưu');
    }
    return {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? '',
      ward: address.ward,
      district: address.district,
      province: address.province,
      contactEmail,
    };
  }

  if (!data.shipping) {
    throw new ApiError(400, 'SHIPPING_REQUIRED', 'Vui lòng chọn hoặc nhập địa chỉ giao hàng');
  }
  return { ...data.shipping, contactEmail };
}

/**
 * Validates the cart against live product state and returns the order lines.
 * Prices always come from the product document — client-supplied prices or
 * totals are ignored entirely (FR-06, Story 3.2).
 */
async function buildOrderLines(
  items: Array<{ productId: Types.ObjectId; qty: number }>,
): Promise<{ lines: OrderLine[]; products: Map<string, ProductDocument> }> {
  const products = await ProductModel.find({ _id: { $in: items.map((item) => item.productId) } }).exec();
  const productById = new Map(products.map((product) => [String(product._id), product]));

  const lines: OrderLine[] = [];
  for (const item of items) {
    const product = productById.get(String(item.productId));
    if (!product || !product.isActive || product.isDeleted) {
      throw new ApiError(400, 'PRODUCT_UNAVAILABLE', 'Một số sản phẩm không còn kinh doanh', {
        productId: String(item.productId),
      });
    }
    const availableStock = Math.max(0, product.stockOnHand - product.stockReserved);
    if (item.qty > availableStock) {
      throw new ApiError(400, 'INSUFFICIENT_STOCK', 'Số lượng vượt quá tồn kho khả dụng', {
        productId: String(product._id),
        name: product.name,
        availableStock,
      });
    }
    const unitPrice = product.effectivePrice ?? product.price;
    lines.push({
      productId: product._id,
      nameSnapshot: product.name,
      skuSnapshot: product.sku,
      unitPrice,
      qty: item.qty,
      lineTotal: unitPrice * item.qty,
    });
  }
  return { lines, products: productById };
}

/** Story 3.6 — reserve each line atomically; on any failure release the rest. */
async function reserveOrderStock(lines: OrderLine[]): Promise<void> {
  const reserved: OrderLine[] = [];
  try {
    for (const line of lines) {
      const ok = await reserveStock(line.productId, line.qty);
      if (!ok) {
        throw new ApiError(400, 'INSUFFICIENT_STOCK', 'Số lượng vượt quá tồn kho khả dụng', {
          productId: String(line.productId),
        });
      }
      reserved.push(line);
    }
  } catch (error) {
    for (const line of reserved) {
      await releaseStock(line.productId, line.qty).catch(() => undefined);
    }
    throw error;
  }
}

async function undoOrderWrites(orderId: Types.ObjectId | undefined, lines: OrderLine[]): Promise<void> {
  if (orderId) {
    await OrderItemModel.deleteMany({ orderId }).catch(() => undefined);
    await OrderStatusEventModel.deleteMany({ orderId }).catch(() => undefined);
    await OrderModel.deleteOne({ _id: orderId }).catch(() => undefined);
  }
  for (const line of lines) {
    await releaseStock(line.productId, line.qty).catch(() => undefined);
  }
}

/**
 * Story 3.4 — creates a pending/unpaid order from the current cart.
 * Story 3.6 — reserves stock without deducting stock on hand.
 *
 * No multi-document transaction (ADR-0011): reservations are atomic
 * conditional updates claimed before the order is written, and any failure
 * after that point compensates — the order document is removed and every
 * reservation released — so a failure can never leave an order without
 * reservation, a reservation without an order, or a half-cleared cart.
 */
export async function checkout(user: UserDto, input: unknown): Promise<OrderDetailDto> {
  const data = parseInput(checkoutSchema, input);
  const shipping = await resolveShipping(user, data);

  const { cart, items } = await loadCartItems(user.id);
  if (items.length === 0) {
    throw new ApiError(400, 'CART_EMPTY', 'Giỏ hàng đang trống');
  }

  const { lines } = await buildOrderLines(items);
  await reserveOrderStock(lines);

  const totals = computeOrderTotals({ lineItems: lines, shippingFee: SHIPPING_FEE_VND });

  let order: OrderDocument | null = null;
  try {
    for (let attempt = 0; attempt < MAX_ORDER_NO_ATTEMPTS; attempt += 1) {
      try {
        order = await OrderModel.create({
          orderNo: generateOrderNo(),
          userId: user.id,
          paymentMethod: data.paymentMethod,
          paymentStatus: 'unpaid',
          orderStatus: 'pending',
          paidAt: null,
          totals,
          inventoryState: 'reserved',
          membershipTierCode: null,
          shippingFullName: shipping.fullName,
          shippingPhone: shipping.phone,
          shippingLine1: shipping.line1,
          shippingLine2: shipping.line2,
          shippingWard: shipping.ward,
          shippingDistrict: shipping.district,
          shippingProvince: shipping.province,
          contactEmail: shipping.contactEmail,
          notesCustomer: data.notesCustomer,
          createdBy: user.id,
        });
        break;
      } catch (error) {
        const duplicate = (error as { code?: number }).code === 11000;
        if (!duplicate || attempt === MAX_ORDER_NO_ATTEMPTS - 1) throw error;
      }
    }

    await OrderItemModel.insertMany(lines.map((line) => ({ orderId: order!._id, ...line })));
    await OrderStatusEventModel.create({
      orderId: order!._id,
      fromStatus: null,
      toStatus: 'pending',
      changedBy: user.id,
      reason: 'Đặt hàng thành công',
    });
    await recordAudit({
      actor: { userId: user.id, role: 'customer', label: user.fullName },
      action: 'order.create',
      entityType: 'order',
      entityId: order!._id,
      nextValue: { orderNo: order!.orderNo, orderStatus: 'pending', paymentStatus: 'unpaid' },
    });

    // Story 3.4 — the cart clears only after the order exists (FR-06.7).
    await CartItemModel.deleteMany({ cartId: cart._id }).exec();
  } catch (error) {
    await undoOrderWrites(order?._id, lines);
    throw error;
  }

  const orderItems = await OrderItemModel.find({ orderId: order!._id }).exec();
  const events = await OrderStatusEventModel.find({ orderId: order!._id }).sort({ createdAt: 1 }).exec();
  return toOrderDetailDto(order!, orderItems, events);
}

/**
 * `POST /orders/preview` — server-side totals for the checkout screen so the
 * client never computes money (FR-09.7a). Coupon/points stay at zero until
 * Epics 8/9 land; the schema fields are preserved.
 */
export async function previewOrder(user: UserDto): Promise<{ itemCount: number; totals: OrderTotals }> {
  const { items } = await loadCartItems(user.id);
  if (items.length === 0) {
    throw new ApiError(400, 'CART_EMPTY', 'Giỏ hàng đang trống');
  }
  const { lines } = await buildOrderLines(items);
  return {
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    totals: computeOrderTotals({ lineItems: lines, shippingFee: SHIPPING_FEE_VND }),
  };
}

/** Story 3.5 — the customer's own orders, newest first. */
export async function listOrders(
  userId: string,
  query: unknown,
): Promise<{ items: OrderListItemDto[]; meta: ReturnType<typeof buildPageMeta> }> {
  const { page, limit } = parseInput(orderListQuerySchema, query, 'Tham số truy vấn không hợp lệ');
  const filter = { userId };
  const [orders, total] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip(skipForPage(page, limit)).limit(limit).exec(),
    OrderModel.countDocuments(filter).exec(),
  ]);

  const countByOrder = await countItemsByOrder(orders.map((order) => order._id));

  return {
    items: orders.map((order) => toOrderListItemDto(order, countByOrder.get(String(order._id)) ?? 0)),
    meta: buildPageMeta(page, limit, total),
  };
}

/** Story 3.5 — order detail scoped to the owning customer (FR-06.8). */
export async function getOrderDetail(userId: string, orderNo: string): Promise<OrderDetailDto> {
  const order = await OrderModel.findOne({ orderNo: orderNo.toUpperCase(), userId }).exec();
  if (!order) {
    throw ApiError.notFound('Không tìm thấy đơn hàng');
  }
  const [items, events] = await Promise.all([
    OrderItemModel.find({ orderId: order._id }).sort({ createdAt: 1 }).exec(),
    OrderStatusEventModel.find({ orderId: order._id }).sort({ createdAt: 1 }).exec(),
  ]);
  return toOrderDetailDto(order, items, events);
}
