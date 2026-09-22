import type { Types } from 'mongoose';
import { OrderItemModel } from '../models/OrderItem.js';
import {
  OrderModel,
  type InventoryState,
  type OrderStatus,
  type PaymentMethod,
} from '../models/Order.js';
import { OrderStatusEventModel } from '../models/OrderStatusEvent.js';
import { ProductModel } from '../models/Product.js';
import { UserModel } from '../models/User.js';
import { computeOrderTotals } from '../modules/orders/orderTotals.js';

interface SeedOrderLine {
  sku: string;
  qty: number;
}

interface SeedOrder {
  orderNo: string;
  orderStatus: OrderStatus;
  paymentMethod: PaymentMethod;
  inventoryState: InventoryState;
  itemSkus: SeedOrderLine[];
  shippingFee: number;
  notesCustomer?: string;
  statusTimeline: Array<{ fromStatus: OrderStatus | null; toStatus: OrderStatus; reason: string }>;
}

/**
 * Story 1.4 — sample unpaid/manual-payment orders across statuses for the
 * seed customer. `paymentStatus` stays `unpaid` everywhere: only Admin or
 * Employee may mark an order paid after offline verification.
 */
const SEED_ORDERS: SeedOrder[] = [
  {
    orderNo: 'DRD-SEED-001',
    orderStatus: 'pending',
    paymentMethod: 'cod',
    inventoryState: 'reserved',
    itemSkus: [
      { sku: 'LRP-EFC-400', qty: 1 },
      { sku: 'CCN-RMA-310', qty: 2 },
    ],
    shippingFee: 30000,
    notesCustomer: 'Giao giờ hành chính giúp em ạ.',
    statusTimeline: [{ fromStatus: null, toStatus: 'pending', reason: 'Đặt hàng thành công' }],
  },
  {
    orderNo: 'DRD-SEED-002',
    orderStatus: 'processing',
    paymentMethod: 'bank_transfer',
    inventoryState: 'reserved',
    itemSkus: [{ sku: 'CRV-HYD-473', qty: 1 }],
    shippingFee: 0,
    statusTimeline: [
      { fromStatus: null, toStatus: 'pending', reason: 'Đặt hàng thành công' },
      { fromStatus: 'pending', toStatus: 'processing', reason: 'Xác nhận đơn, chờ chuyển khoản' },
    ],
  },
  {
    orderNo: 'DRD-SEED-003',
    orderStatus: 'shipped',
    paymentMethod: 'momo_manual',
    inventoryState: 'deducted',
    itemSkus: [{ sku: 'TOR-NIA-030', qty: 2 }],
    shippingFee: 30000,
    statusTimeline: [
      { fromStatus: null, toStatus: 'pending', reason: 'Đặt hàng thành công' },
      { fromStatus: 'pending', toStatus: 'processing', reason: 'Đã xác nhận thanh toán MoMo thủ công' },
      { fromStatus: 'processing', toStatus: 'shipped', reason: 'Đã bàn giao đơn vị vận chuyển' },
    ],
  },
  {
    orderNo: 'DRD-SEED-004',
    orderStatus: 'cancelled',
    paymentMethod: 'cod',
    inventoryState: 'released',
    itemSkus: [{ sku: 'SBM-TNR-150', qty: 1 }],
    shippingFee: 30000,
    statusTimeline: [
      { fromStatus: null, toStatus: 'pending', reason: 'Đặt hàng thành công' },
      { fromStatus: 'pending', toStatus: 'cancelled', reason: 'Khách yêu cầu hủy trước khi giao' },
    ],
  },
];

export async function seedOrders(): Promise<string> {
  const customer = await UserModel.findOne({ email: 'customer@drdo.vn' }).exec();
  const employee = await UserModel.findOne({ email: 'employee@drdo.vn' }).exec();
  if (!customer) {
    throw new Error('Seed customer@drdo.vn missing — run the users seeder first');
  }

  let itemCount = 0;
  let eventCount = 0;

  for (const seed of SEED_ORDERS) {
    const lines: Array<{
      productId: Types.ObjectId;
      nameSnapshot: string;
      skuSnapshot: string;
      unitPrice: number;
      qty: number;
      lineTotal: number;
    }> = [];

    for (const line of seed.itemSkus) {
      const product = await ProductModel.findOne({ sku: line.sku }).exec();
      if (!product) {
        throw new Error(`Seed order ${seed.orderNo} references unknown SKU ${line.sku}`);
      }
      const unitPrice = product.effectivePrice ?? product.price;
      lines.push({
        productId: product._id,
        nameSnapshot: product.name,
        skuSnapshot: product.sku,
        unitPrice,
        qty: line.qty,
        lineTotal: unitPrice * line.qty,
      });
    }

    const totals = computeOrderTotals({ lineItems: lines, shippingFee: seed.shippingFee });

    const order = await OrderModel.findOneAndUpdate(
      { orderNo: seed.orderNo },
      {
        $set: {
          orderNo: seed.orderNo,
          userId: customer._id,
          paymentMethod: seed.paymentMethod,
          paymentStatus: 'unpaid',
          orderStatus: seed.orderStatus,
          paidAt: null,
          totals,
          inventoryState: seed.inventoryState,
          membershipTierCode: 'BRONZE',
          shippingFullName: customer.fullName,
          shippingPhone: customer.phone || '0900000003',
          shippingLine1: '123 Nguyễn Huệ',
          shippingLine2: '',
          shippingWard: 'Phường Bến Nghé',
          shippingDistrict: 'Quận 1',
          shippingProvince: 'TP. Hồ Chí Minh',
          contactEmail: customer.email,
          notesCustomer: seed.notesCustomer ?? '',
          notesInternal: 'Seed order — manual payment unpaid',
          createdBy: customer._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    // Replace items/events so re-runs stay deterministic.
    await OrderItemModel.deleteMany({ orderId: order._id }).exec();
    await OrderStatusEventModel.deleteMany({ orderId: order._id }).exec();

    for (const line of lines) {
      await OrderItemModel.create({ orderId: order._id, ...line });
      itemCount += 1;
    }

    for (const event of seed.statusTimeline) {
      await OrderStatusEventModel.create({
        orderId: order._id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        changedBy: event.fromStatus === null ? customer._id : (employee?._id ?? customer._id),
        reason: event.reason,
      });
      eventCount += 1;
    }
  }

  return `${SEED_ORDERS.length} orders (${itemCount} items, ${eventCount} status events, all unpaid)`;
}
