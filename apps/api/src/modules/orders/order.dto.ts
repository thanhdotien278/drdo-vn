import type { OrderItemDocument } from '../../models/OrderItem.js';
import type {
  InventoryState,
  OrderDocument,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../models/Order.js';
import type { OrderStatusEventDocument } from '../../models/OrderStatusEvent.js';
import type { UserDocument } from '../../models/User.js';
import type { OrderTotals } from './orderTotals.js';

export interface OrderItemDto {
  id: string;
  productId: string;
  name: string;
  sku: string;
  imageUrl: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface OrderShippingDto {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  ward: string;
  district: string;
  province: string;
  contactEmail: string;
}

export interface OrderTimelineEventDto {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string;
  createdAt: string;
}

export interface OrderListItemDto {
  id: string;
  orderNo: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  grandTotal: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetailDto {
  id: string;
  orderNo: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidAt: string | null;
  createdAt: string;
  notesCustomer: string;
  membershipTierCode: string | null;
  items: OrderItemDto[];
  totals: OrderTotals;
  shipping: OrderShippingDto;
  timeline: OrderTimelineEventDto[];
  /** Checkout response only — whether the opt-in shipping address was saved. */
  addressSaved?: boolean;
}

/** Account behind the order — staff-facing context beyond the shipping snapshot. */
export interface OrderCustomerDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
}

export interface StaffOrderListItemDto extends OrderListItemDto {
  customerName: string;
}

export interface StaffOrderDetailDto extends OrderDetailDto {
  customer: OrderCustomerDto | null;
  notesInternal: string;
  inventoryState: InventoryState;
}

function toOrderItemDto(item: OrderItemDocument): OrderItemDto {
  return {
    id: String(item._id),
    productId: String(item.productId),
    name: item.nameSnapshot,
    sku: item.skuSnapshot,
    // Orders placed before image snapshots existed fall back to ''.
    imageUrl: item.imageUrlSnapshot ?? '',
    unitPrice: item.unitPrice,
    qty: item.qty,
    lineTotal: item.lineTotal,
  };
}

function toShippingDto(order: OrderDocument): OrderShippingDto {
  return {
    fullName: order.shippingFullName,
    phone: order.shippingPhone,
    line1: order.shippingLine1,
    line2: order.shippingLine2 ?? '',
    ward: order.shippingWard,
    district: order.shippingDistrict,
    province: order.shippingProvince,
    contactEmail: order.contactEmail,
  };
}

export function toOrderListItemDto(order: OrderDocument, itemCount: number): OrderListItemDto {
  return {
    id: String(order._id),
    orderNo: order.orderNo,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    grandTotal: order.totals.grandTotal,
    itemCount,
    createdAt: order.createdAt.toISOString(),
  };
}

export function toOrderDetailDto(
  order: OrderDocument,
  items: OrderItemDocument[],
  events: OrderStatusEventDocument[],
): OrderDetailDto {
  return {
    id: String(order._id),
    orderNo: order.orderNo,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    notesCustomer: order.notesCustomer ?? '',
    membershipTierCode: order.membershipTierCode ?? null,
    items: items.map(toOrderItemDto),
    totals: {
      subtotal: order.totals.subtotal,
      discountAmount: order.totals.discountAmount,
      couponRef: order.totals.couponRef
        ? {
            couponId: order.totals.couponRef.couponId
              ? String(order.totals.couponRef.couponId)
              : null,
            promotionId: order.totals.couponRef.promotionId
              ? String(order.totals.couponRef.promotionId)
              : null,
            code: order.totals.couponRef.code,
            discountType: order.totals.couponRef.discountType,
            discountValue: order.totals.couponRef.discountValue,
            maxDiscountAmount: order.totals.couponRef.maxDiscountAmount ?? null,
          }
        : null,
      pointsRedeemed: order.totals.pointsRedeemed,
      pointsDiscountAmount: order.totals.pointsDiscountAmount,
      shippingFee: order.totals.shippingFee,
      grandTotal: order.totals.grandTotal,
    },
    shipping: toShippingDto(order),
    timeline: events.map((event) => ({
      fromStatus: event.fromStatus ?? null,
      toStatus: event.toStatus,
      reason: event.reason ?? '',
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export function toStaffOrderListItemDto(
  order: OrderDocument,
  itemCount: number,
): StaffOrderListItemDto {
  return { ...toOrderListItemDto(order, itemCount), customerName: order.shippingFullName };
}

export function toStaffOrderDetailDto(
  order: OrderDocument,
  items: OrderItemDocument[],
  events: OrderStatusEventDocument[],
  customer: UserDocument | null,
): StaffOrderDetailDto {
  return {
    ...toOrderDetailDto(order, items, events),
    customer: customer
      ? {
          id: String(customer._id),
          fullName: customer.fullName,
          email: customer.email,
          phone: customer.phone ?? '',
        }
      : null,
    notesInternal: order.notesInternal ?? '',
    inventoryState: order.inventoryState,
  };
}
