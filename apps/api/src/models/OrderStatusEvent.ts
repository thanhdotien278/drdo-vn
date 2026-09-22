import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ORDER_STATUSES } from './Order.js';

const orderStatusEventSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    fromStatus: { type: String, enum: ORDER_STATUSES, default: null },
    toStatus: { type: String, enum: ORDER_STATUSES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

orderStatusEventSchema.index({ orderId: 1, createdAt: 1 });

export type OrderStatusEvent = InferSchemaType<typeof orderStatusEventSchema>;
export type OrderStatusEventDocument = HydratedDocument<OrderStatusEvent>;
export const OrderStatusEventModel = model('OrderStatusEvent', orderStatusEventSchema);
