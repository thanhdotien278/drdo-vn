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
import { CouponRedemptionModel } from '../../models/CouponRedemption.js';
import { LoyaltyLedgerEntryModel } from '../../models/LoyaltyLedgerEntry.js';
import { ProductModel, type ProductDocument } from '../../models/Product.js';
import type { UserDto } from '../auth/auth.dto.js';
import { ApiError } from '../../utils/apiError.js';
import { buildPageMeta, paginationQuerySchema, skipForPage } from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit } from '../audit/audit.service.js';
import { createAddress } from '../addresses/address.service.js';
import { loadCartItems } from '../cart/cart.service.js';
import { releaseStock, reserveStock } from './inventory.js';
import {
  toOrderDetailDto,
  toOrderListItemDto,
  type OrderDetailDto,
  type OrderListItemDto,
} from './order.dto.js';
import { nextOrderNo } from './orderNo.js';
import { countItemsByOrder } from './orderItemCounts.js';
import { computeOrderTotals, type OrderTotals } from './orderTotals.js';
import {
  aggregatePoints,
  getAccount,
  getActiveTierByCode,
  getOrCreateAccount,
  maxRedeemablePoints,
  redeemPoints,
  shippingFeeForTier,
  validateRedemption,
} from '../loyalty/loyalty.service.js';
import { resolveCoupon, type ResolvedCoupon } from '../promotions/promotion.service.js';

/**
 * Flat shipping fee lives in `orderTotals.ts` with the other money constants;
 * tier free-shipping (Epic 8) can zero it out via `shippingFeeForTier`.
 */
export { SHIPPING_FEE_VND } from './orderTotals.js';

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
  pointsToRedeem: z.number().int().min(0).optional().default(0),
  couponCode: z.string().trim().max(50).optional(),
  saveAddress: z.boolean().optional().default(false),
});

const previewSchema = z.object({
  pointsToRedeem: z.number().int().min(0).optional().default(0),
  couponCode: z.string().trim().max(50).optional(),
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

/** Epic 9 — the redemption row tying the applied coupon to the new order. */
async function writeCouponRedemption(
  applied: ResolvedCoupon,
  order: OrderDocument,
  userId: string,
): Promise<void> {
  await CouponRedemptionModel.create({
    couponId: applied.coupon._id,
    promotionId: applied.promotion._id,
    orderId: order._id,
    orderNo: order.orderNo,
    userId,
    code: applied.coupon.code,
    discountAmount: applied.discountAmount,
    status: 'applied',
  });
}

async function undoOrderWrites(orderId: Types.ObjectId | undefined, lines: OrderLine[]): Promise<void> {
  if (orderId) {
    await OrderItemModel.deleteMany({ orderId }).catch(() => undefined);
    await OrderStatusEventModel.deleteMany({ orderId }).catch(() => undefined);
    // Epic 8 — a compensated order must not leave its redemption behind.
    await LoyaltyLedgerEntryModel.deleteMany({ orderId }).catch(() => undefined);
    // Epic 9 — same for the coupon redemption written inside the try block.
    await CouponRedemptionModel.deleteMany({ orderId }).catch(() => undefined);
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

  const { lines, products } = await buildOrderLines(items);

  // Epic 8/9 — coupon and loyalty resolve BEFORE stock is reserved so a
  // rejected coupon/redemption never leaks reservations. Totals ordering
  // (Epic 8 contract): subtotal → coupon discountAmount → tier free
  // shipping on (subtotal − discountAmount) → points redemption (cap still
  // on the full subtotal).
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const loyaltyAccount = await getOrCreateAccount(user.id);
  const applied = data.couponCode
    ? await resolveCoupon({
        code: data.couponCode,
        userId: user.id,
        lines,
        products,
        tierCode: loyaltyAccount.tierCode,
      })
    : null;
  const discountAmount = applied?.discountAmount ?? 0;
  const tier = await getActiveTierByCode(loyaltyAccount.tierCode);
  if (data.pointsToRedeem > 0) {
    const { balance } = await aggregatePoints(user.id);
    validateRedemption(data.pointsToRedeem, subtotal, balance);
  }
  const shippingFee = shippingFeeForTier(tier, subtotal - discountAmount);
  const totals = computeOrderTotals({
    lineItems: lines,
    discountAmount,
    couponRef: applied?.snapshot ?? null,
    shippingFee,
    pointsRedeemed: data.pointsToRedeem,
  });

  await reserveOrderStock(lines);

  let order: OrderDocument | null = null;
  try {
    order = await OrderModel.create({
      orderNo: await nextOrderNo(),
      userId: user.id,
      paymentMethod: data.paymentMethod,
      paymentStatus: 'unpaid',
      orderStatus: 'pending',
      paidAt: null,
      totals,
      inventoryState: 'reserved',
      membershipTierCode: loyaltyAccount.tierCode,
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

    await OrderItemModel.insertMany(lines.map((line) => ({ orderId: order!._id, ...line })));
    await OrderStatusEventModel.create({
      orderId: order!._id,
      fromStatus: null,
      toStatus: 'pending',
      changedBy: user.id,
      reason: 'Đặt hàng thành công',
    });
    // Epic 8 — redemption is deducted at order creation, inside the
    // compensate-on-failure block. Cancelled orders never refund points.
    if (data.pointsToRedeem > 0) {
      await redeemPoints({
        userId: user.id,
        orderId: order!._id,
        orderNo: order!.orderNo,
        points: data.pointsToRedeem,
      });
    }
    // Epic 9 — one `applied` redemption per order; the unique orderId index
    // makes a second coupon on the same order impossible, and
    // `undoOrderWrites` removes it if anything below fails.
    if (applied) {
      await writeCouponRedemption(applied, order!, user.id);
    }
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

  // FR-09.5 — "save this address" at checkout is best-effort: the order is
  // already committed, so a failure here must not roll it back. The first
  // saved address becomes default automatically via createAddress; only
  // explicit opt-in writes to the address book — order snapshots are never
  // copied into it.
  let addressSaved = false;
  if (data.saveAddress && data.shipping) {
    try {
      await createAddress(user.id, data.shipping);
      addressSaved = true;
    } catch (error) {
      // Best-effort, but never silent: the failure is logged for ops and the
      // `addressSaved` flag tells the client the opt-in did not take effect.
      console.error('[checkout] failed to save address for user', user.id, error);
    }
  }

  const orderItems = await OrderItemModel.find({ orderId: order!._id }).exec();
  const events = await OrderStatusEventModel.find({ orderId: order!._id }).sort({ createdAt: 1 }).exec();
  return { ...toOrderDetailDto(order!, orderItems, events), addressSaved };
}

export interface OrderPreviewDto {
  itemCount: number;
  totals: OrderTotals;
  loyalty: {
    balance: number;
    tierCode: string;
    tierName: string;
    earnMultiplier: number;
    freeShippingThreshold: number | null;
    freeShippingApplied: boolean;
    maxRedeemablePoints: number;
    pointsToRedeem: number;
  };
}

/**
 * `POST /orders/preview` — server-side totals for the checkout screen so the
 * client never computes money (FR-09.7a). Epic 8/9: accepts `pointsToRedeem`
 * and `couponCode`, applying the same strict rejection rules as checkout;
 * tier free shipping is evaluated on the discounted subtotal before
 * redemption.
 */
export async function previewOrder(user: UserDto, input: unknown): Promise<OrderPreviewDto> {
  const data = parseInput(previewSchema, input ?? {});
  const { items } = await loadCartItems(user.id);
  if (items.length === 0) {
    throw new ApiError(400, 'CART_EMPTY', 'Giỏ hàng đang trống');
  }
  const { lines, products } = await buildOrderLines(items);

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const account = await getAccount(user.id);
  const tierCode = account?.tierCode ?? 'BRONZE';
  // Epic 9 — the same resolveCoupon validation as checkout, so the checkout
  // screen shows real discounts and never disagrees with the order (§14.6).
  const applied = data.couponCode
    ? await resolveCoupon({
        code: data.couponCode,
        userId: user.id,
        lines,
        products,
        tierCode,
      })
    : null;
  const discountAmount = applied?.discountAmount ?? 0;
  const tier = await getActiveTierByCode(tierCode);
  const { balance } = await aggregatePoints(user.id);
  if (data.pointsToRedeem > 0) {
    validateRedemption(data.pointsToRedeem, subtotal, balance);
  }
  const shippingFee = shippingFeeForTier(tier, subtotal - discountAmount);

  return {
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    totals: computeOrderTotals({
      lineItems: lines,
      discountAmount,
      couponRef: applied?.snapshot ?? null,
      shippingFee,
      pointsRedeemed: data.pointsToRedeem,
    }),
    loyalty: {
      balance,
      tierCode,
      tierName: tier?.name ?? tierCode,
      earnMultiplier: tier?.earnMultiplier ?? 1,
      freeShippingThreshold: tier?.freeShippingThreshold ?? null,
      freeShippingApplied: shippingFee === 0 && tier?.freeShippingThreshold != null,
      maxRedeemablePoints: maxRedeemablePoints(balance, subtotal),
      pointsToRedeem: data.pointsToRedeem,
    },
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
