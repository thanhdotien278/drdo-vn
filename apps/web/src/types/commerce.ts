export interface CartProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  effectivePrice: number;
  availableStock: number;
  inStock: boolean;
  purchasable: boolean;
}

export interface CartItem {
  id: string;
  product: CartProduct | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  ward: string;
  district: string;
  province: string;
  isDefault: boolean;
}

export type PaymentMethod = 'cod' | 'bank_transfer' | 'momo_manual';
export type PaymentStatus = 'unpaid' | 'paid';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  couponRef: unknown;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  shippingFee: number;
  grandTotal: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface OrderShipping {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  ward: string;
  district: string;
  province: string;
  contactEmail: string;
}

export interface OrderTimelineEvent {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string;
  createdAt: string;
}

export interface OrderListItem {
  id: string;
  orderNo: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  grandTotal: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNo: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paidAt: string | null;
  createdAt: string;
  notesCustomer: string;
  items: OrderItem[];
  totals: OrderTotals;
  shipping: OrderShipping;
  timeline: OrderTimelineEvent[];
}

export interface OrderPreview {
  itemCount: number;
  totals: OrderTotals;
}

export type InventoryState = 'reserved' | 'deducted' | 'released';

export interface OrderCustomer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
}

export interface StaffOrderListItem extends OrderListItem {
  customerName: string;
}

export interface StaffOrderDetail extends OrderDetail {
  customer: OrderCustomer | null;
  notesInternal: string;
  inventoryState: InventoryState;
}

export interface CheckoutInput {
  paymentMethod: PaymentMethod;
  addressId?: string;
  shipping?: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    ward: string;
    district: string;
    province: string;
  };
  contactEmail?: string;
  notesCustomer?: string;
}
