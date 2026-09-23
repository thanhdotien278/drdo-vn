import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Story 7.1 — one persistent wishlist per customer (ERD `WISHLIST_ITEMS`).
 * Like `CART_ITEMS`, each row anchors one product to one customer; the
 * unique (userId, productId) index backs the application-level rule that
 * re-adding a product is a safe no-op rather than a duplicate row.
 *
 * The row stores no price/stock data — the wishlist always resolves live
 * product information when read (Story 7.2).
 */
const wishlistItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    addedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

wishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

export type WishlistItem = InferSchemaType<typeof wishlistItemSchema>;
export type WishlistItemDocument = HydratedDocument<WishlistItem>;
export const WishlistItemModel = model('WishlistItem', wishlistItemSchema);
