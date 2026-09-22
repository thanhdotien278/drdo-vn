import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Story 3.1 — cart lines (ERD `CART_ITEMS`). `unitPriceSnapshot` is set
 * server-side from the product's effective price whenever the line is added
 * or its quantity changes; client-supplied prices are never stored.
 */
const cartItemSchema = new Schema(
  {
    cartId: { type: Schema.Types.ObjectId, ref: 'Cart', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPriceSnapshot: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

cartItemSchema.index({ cartId: 1, productId: 1 }, { unique: true });

export type CartItem = InferSchemaType<typeof cartItemSchema>;
export type CartItemDocument = HydratedDocument<CartItem>;
export const CartItemModel = model('CartItem', cartItemSchema);
