import type { Cart } from '../types/commerce';
import type { WishlistItem } from '../types/engagement';
import { apiRequest } from './client';

export function fetchWishlist(): Promise<{ data: WishlistItem[] }> {
  return apiRequest<WishlistItem[]>('GET', '/wishlist');
}

export function addWishlistItem(productId: string): Promise<{ data: WishlistItem[] }> {
  return apiRequest<WishlistItem[]>('POST', '/wishlist/items', { body: { productId } });
}

export function removeWishlistItem(productId: string): Promise<{ data: WishlistItem[] }> {
  return apiRequest<WishlistItem[]>('DELETE', `/wishlist/items/${encodeURIComponent(productId)}`);
}

/** Story 7.2 — add to cart via the Epic 3 service; the row is removed server-side on success. */
export function moveWishlistToCart(
  productId: string,
): Promise<{ data: { wishlist: WishlistItem[]; cart: Cart } }> {
  return apiRequest('POST', `/wishlist/items/${encodeURIComponent(productId)}/move-to-cart`, {
    body: {},
  });
}
