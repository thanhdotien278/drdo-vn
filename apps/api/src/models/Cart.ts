import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Story 3.1 — one persistent cart per customer (ERD `CARTS`).
 * Items live in `CartItem` per the ERD; the cart itself only anchors
 * ownership so cart operations stay scoped to the authenticated customer.
 */
const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  },
  { timestamps: true },
);

export type Cart = InferSchemaType<typeof cartSchema>;
export type CartDocument = HydratedDocument<Cart>;
export const CartModel = model('Cart', cartSchema);
