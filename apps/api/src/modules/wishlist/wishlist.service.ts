import { Types } from 'mongoose';
import { z } from 'zod';
import { ProductModel } from '../../models/Product.js';
import { WishlistItemModel } from '../../models/WishlistItem.js';
import { ApiError } from '../../utils/apiError.js';
import { parseInput } from '../../utils/validate.js';
import { addCartItem } from '../cart/cart.service.js';
import type { CartDto } from '../cart/cart.dto.js';
import { toWishlistItemDto, type WishlistItemDto } from './wishlist.dto.js';

/**
 * Stories 7.1/7.2 — the customer's persistent wishlist. Rows are keyed by
 * (userId, productId) so customer isolation is structural: every query is
 * scoped by the caller's userId and there is no route that accepts another
 * customer's id.
 */

const addItemSchema = z.object({
  productId: z.string().trim().min(1),
});

function assertProductId(productId: string): void {
  if (!Types.ObjectId.isValid(productId)) {
    throw ApiError.notFound('Không tìm thấy sản phẩm trong danh sách yêu thích');
  }
}

/**
 * List entries with live product data. Inactive or soft-deleted products are
 * filtered out of the response but the row is deliberately kept — a
 * reactivated product reappears automatically (Story 7.2).
 */
export async function listWishlist(userId: string): Promise<WishlistItemDto[]> {
  const items = await WishlistItemModel.find({ userId }).sort({ addedAt: -1 }).exec();
  const products = await ProductModel.find({
    _id: { $in: items.map((item) => item.productId) },
  }).exec();
  const productById = new Map(products.map((product) => [String(product._id), product]));

  return items.flatMap((item) => {
    const product = productById.get(String(item.productId));
    if (!product || !product.isActive || product.isDeleted) {
      return [];
    }
    return [toWishlistItemDto(item, product)];
  });
}

/**
 * Add a product to the wishlist. Re-adding is a safe no-op: the upsert only
 * sets fields on insert and the unique index is the backstop against races.
 */
export async function addWishlistItem(
  userId: string,
  input: unknown,
): Promise<WishlistItemDto[]> {
  const data = parseInput(addItemSchema, input);
  if (!Types.ObjectId.isValid(data.productId)) {
    throw ApiError.notFound('Không tìm thấy sản phẩm');
  }
  const product = await ProductModel.findById(data.productId).exec();
  if (!product || product.isDeleted) {
    throw new ApiError(400, 'PRODUCT_UNAVAILABLE', 'Sản phẩm không còn kinh doanh');
  }

  await WishlistItemModel.findOneAndUpdate(
    { userId, productId: product._id },
    { $setOnInsert: { userId, productId: product._id } },
    { upsert: true, setDefaultsOnInsert: true },
  ).exec();

  return listWishlist(userId);
}

export async function removeWishlistItem(
  userId: string,
  productId: string,
): Promise<WishlistItemDto[]> {
  assertProductId(productId);
  const removed = await WishlistItemModel.findOneAndDelete({ userId, productId }).exec();
  if (!removed) {
    throw ApiError.notFound('Không tìm thấy sản phẩm trong danh sách yêu thích');
  }
  return listWishlist(userId);
}

/**
 * Story 7.2 — move to cart. The add goes through the Epic 3 cart service so
 * stock/availability validation is single-sourced; the wishlist row is only
 * removed after the cart add succeeds, so a rejected move preserves the row.
 */
export async function moveWishlistItemToCart(
  userId: string,
  productId: string,
): Promise<{ wishlist: WishlistItemDto[]; cart: CartDto }> {
  assertProductId(productId);
  const item = await WishlistItemModel.findOne({ userId, productId }).exec();
  if (!item) {
    throw ApiError.notFound('Không tìm thấy sản phẩm trong danh sách yêu thích');
  }

  const cart = await addCartItem(userId, { productId, qty: 1 });
  await WishlistItemModel.deleteOne({ _id: item._id }).exec();

  return { wishlist: await listWishlist(userId), cart };
}
