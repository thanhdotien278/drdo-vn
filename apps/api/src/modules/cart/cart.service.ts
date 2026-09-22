import { Types } from 'mongoose';
import { z } from 'zod';
import { CartModel, type CartDocument } from '../../models/Cart.js';
import { CartItemModel, type CartItemDocument } from '../../models/CartItem.js';
import { ProductModel, type ProductDocument } from '../../models/Product.js';
import { ApiError } from '../../utils/apiError.js';
import { parseInput } from '../../utils/validate.js';
import { toCartDto, toCartItemDto, type CartDto } from './cart.dto.js';

const MAX_QTY_PER_ITEM = 999;

const addItemSchema = z.object({
  productId: z.string().trim().min(1),
  qty: z.coerce.number().int().min(1).max(MAX_QTY_PER_ITEM).default(1),
});

const updateItemSchema = z.object({
  qty: z.coerce.number().int().min(1).max(MAX_QTY_PER_ITEM),
});

/** Story 3.1 — the customer's single persistent cart, created lazily. */
export async function getOrCreateCart(userId: string): Promise<CartDocument> {
  return CartModel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
}

function purchasableProduct(product: ProductDocument | null): ProductDocument {
  if (!product || !product.isActive || product.isDeleted) {
    throw new ApiError(400, 'PRODUCT_UNAVAILABLE', 'Sản phẩm không còn kinh doanh');
  }
  return product;
}

function assertWithinStock(product: ProductDocument, qty: number): void {
  const availableStock = Math.max(0, product.stockOnHand - product.stockReserved);
  if (qty > availableStock) {
    throw new ApiError(400, 'INSUFFICIENT_STOCK', 'Số lượng vượt quá tồn kho khả dụng', {
      productId: String(product._id),
      availableStock,
    });
  }
}

async function buildCartDto(cart: CartDocument): Promise<CartDto> {
  const items = await CartItemModel.find({ cartId: cart._id }).sort({ addedAt: 1 }).exec();
  const productIds = items.map((item) => item.productId);
  const products = await ProductModel.find({ _id: { $in: productIds } }).exec();
  const productById = new Map(products.map((product) => [String(product._id), product]));
  return toCartDto(
    String(cart._id),
    items.map((item) => toCartItemDto(item, productById.get(String(item.productId)) ?? null)),
  );
}

export async function getCart(userId: string): Promise<CartDto> {
  const cart = await getOrCreateCart(userId);
  return buildCartDto(cart);
}

/** Shared with checkout: the raw cart document plus its item documents. */
export async function loadCartItems(
  userId: string,
): Promise<{ cart: CartDocument; items: CartItemDocument[] }> {
  const cart = await getOrCreateCart(userId);
  const items = await CartItemModel.find({ cartId: cart._id }).exec();
  return { cart, items };
}

/**
 * Story 3.1/3.2 — add or merge a product into the cart (FR-05.2/05.3).
 * Price is snapshotted server-side; quantity is validated against the live
 * available stock (`stockOnHand - stockReserved`).
 */
export async function addCartItem(userId: string, input: unknown): Promise<CartDto> {
  const data = parseInput(addItemSchema, input);
  if (!Types.ObjectId.isValid(data.productId)) {
    throw ApiError.badRequest('Sản phẩm không hợp lệ');
  }

  const cart = await getOrCreateCart(userId);
  const product = purchasableProduct(await ProductModel.findById(data.productId).exec());

  const existing = await CartItemModel.findOne({ cartId: cart._id, productId: product._id }).exec();
  const nextQty = (existing?.qty ?? 0) + data.qty;
  assertWithinStock(product, nextQty);

  if (existing) {
    existing.qty = nextQty;
    existing.unitPriceSnapshot = product.effectivePrice ?? product.price;
    await existing.save();
  } else {
    await CartItemModel.create({
      cartId: cart._id,
      productId: product._id,
      qty: data.qty,
      unitPriceSnapshot: product.effectivePrice ?? product.price,
    });
  }

  return buildCartDto(cart);
}

export async function updateCartItem(
  userId: string,
  itemId: string,
  input: unknown,
): Promise<CartDto> {
  const data = parseInput(updateItemSchema, input);
  if (!Types.ObjectId.isValid(itemId)) {
    throw ApiError.notFound('Không tìm thấy sản phẩm trong giỏ hàng');
  }

  const cart = await getOrCreateCart(userId);
  const item = await CartItemModel.findOne({ _id: itemId, cartId: cart._id }).exec();
  if (!item) {
    throw ApiError.notFound('Không tìm thấy sản phẩm trong giỏ hàng');
  }

  const product = purchasableProduct(await ProductModel.findById(item.productId).exec());
  assertWithinStock(product, data.qty);

  item.qty = data.qty;
  item.unitPriceSnapshot = product.effectivePrice ?? product.price;
  await item.save();

  return buildCartDto(cart);
}

export async function removeCartItem(userId: string, itemId: string): Promise<CartDto> {
  if (!Types.ObjectId.isValid(itemId)) {
    throw ApiError.notFound('Không tìm thấy sản phẩm trong giỏ hàng');
  }
  const cart = await getOrCreateCart(userId);
  const removed = await CartItemModel.findOneAndDelete({ _id: itemId, cartId: cart._id }).exec();
  if (!removed) {
    throw ApiError.notFound('Không tìm thấy sản phẩm trong giỏ hàng');
  }
  return buildCartDto(cart);
}
