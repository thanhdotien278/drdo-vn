import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const orderItemSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    nameSnapshot: { type: String, required: true },
    skuSnapshot: { type: String, required: true },
    imageUrlSnapshot: { type: String, default: '' },
    unitPrice: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type OrderItem = InferSchemaType<typeof orderItemSchema>;
export type OrderItemDocument = HydratedDocument<OrderItem>;
export const OrderItemModel = model('OrderItem', orderItemSchema);
