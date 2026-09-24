import { ApiRequestError } from '../api/client';
import type { ProductListItem } from '../types/catalog';
import type { Cart, CartProduct } from '../types/commerce';

const STORAGE_KEY = 'drdo.guestCart';
const MAX_QTY_PER_ITEM = 999;

export interface GuestCartEntry {
  product: CartProduct;
  qty: number;
}

export function toCartProduct(product: ProductListItem): CartProduct {
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    imageUrl: image?.url ?? '',
    imageAlt: image?.alt ?? product.name,
    effectivePrice: product.effectivePrice,
    availableStock: product.availableStock,
    inStock: product.inStock,
    purchasable: true,
  };
}

export function readGuestEntries(): GuestCartEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return (parsed as GuestCartEntry[]).filter(
      (entry) => Boolean(entry?.product?.id) && Number.isInteger(entry.qty) && entry.qty > 0,
    );
  } catch {
    return [];
  }
}

function writeGuestEntries(entries: GuestCartEntry[]): void {
  if (entries.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

function toCart(entries: GuestCartEntry[]): Cart {
  const items = entries.map((entry) => ({
    id: entry.product.id,
    product: entry.product,
    qty: entry.qty,
    unitPrice: entry.product.effectivePrice,
    lineTotal: entry.qty * entry.product.effectivePrice,
  }));
  return {
    id: 'guest',
    items,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

export function guestCart(): Cart {
  return toCart(readGuestEntries());
}

function assertQty(product: CartProduct, qty: number): void {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
    throw new ApiRequestError(400, 'Số lượng không hợp lệ', 'INVALID_QTY');
  }
  if (qty > product.availableStock) {
    throw new ApiRequestError(400, 'Số lượng vượt quá tồn kho khả dụng', 'INSUFFICIENT_STOCK');
  }
}

export function addGuestItem(product: CartProduct, qty: number): Cart {
  const entries = readGuestEntries();
  const existing = entries.find((entry) => entry.product.id === product.id);
  assertQty(product, (existing?.qty ?? 0) + qty);
  if (existing) {
    existing.qty += qty;
    existing.product = product;
  } else {
    entries.push({ product, qty });
  }
  writeGuestEntries(entries);
  return toCart(entries);
}

export function updateGuestItem(productId: string, qty: number): Cart {
  const entries = readGuestEntries();
  const entry = entries.find((item) => item.product.id === productId);
  if (!entry) {
    throw new ApiRequestError(404, 'Không tìm thấy sản phẩm trong giỏ hàng');
  }
  assertQty(entry.product, qty);
  entry.qty = qty;
  writeGuestEntries(entries);
  return toCart(entries);
}

export function removeGuestItem(productId: string): Cart {
  const entries = readGuestEntries().filter((entry) => entry.product.id !== productId);
  writeGuestEntries(entries);
  return toCart(entries);
}

/**
 * Replays guest items into the signed-in customer's cart (the server
 * re-validates active/stock per item). Items rejected as invalid (400) are
 * dropped; anything else — network errors, 401/403 — stays in the guest cart
 * for the next sign-in.
 */
export async function mergeGuestCart(
  add: (product: CartProduct, qty: number) => Promise<unknown>,
): Promise<void> {
  const remaining: GuestCartEntry[] = [];
  for (const entry of readGuestEntries()) {
    try {
      await add(entry.product, entry.qty);
    } catch (err) {
      if (!(err instanceof ApiRequestError && err.status === 400)) {
        remaining.push(entry);
      }
    }
  }
  writeGuestEntries(remaining);
}
