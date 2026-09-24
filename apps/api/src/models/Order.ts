import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { orderTotalsSchema } from '../modules/orders/orderTotals.js';

export const PAYMENT_METHODS = ['cod', 'bank_transfer', 'momo_manual'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Exactly-once marker for inventory side effects (ADR-0011): claimed by a
 * conditional update before the work so a crash under-applies instead of
 * double-deducting.
 */
export const INVENTORY_STATES = ['reserved', 'deducted', 'released'] as const;
export type InventoryState = (typeof INVENTORY_STATES)[number];

const orderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true, uppercase: true, trim: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'unpaid' },
    orderStatus: { type: String, enum: ORDER_STATUSES, required: true, default: 'pending' },
    paidAt: { type: Date, default: null },

    // FR-09.7 totals block: the shared subdocument from Story 9.1, always
    // stored even when zero, filled only by computeOrderTotals output.
    totals: { type: orderTotalsSchema, required: true },

    inventoryState: { type: String, enum: INVENTORY_STATES, required: true, default: 'reserved' },
    /** Tier at checkout — without it nobody can explain why an old order shipped free. */
    membershipTierCode: { type: String, default: null },

    // Immutable shipping/contact snapshot (FR-03.11); no postal code.
    shippingFullName: { type: String, required: true },
    shippingPhone: { type: String, required: true },
    shippingLine1: { type: String, required: true },
    shippingLine2: { type: String, default: '' },
    shippingWard: { type: String, required: true },
    shippingDistrict: { type: String, required: true },
    shippingProvince: { type: String, required: true },
    contactEmail: { type: String, required: true },
    notesCustomer: { type: String, default: '' },
    notesInternal: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, paidAt: -1 });

export type Order = InferSchemaType<typeof orderSchema>;
export type OrderDocument = HydratedDocument<Order>;
export const OrderModel = model('Order', orderSchema);
