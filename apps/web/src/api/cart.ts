import { addGuestItem, guestCart, removeGuestItem, toCartProduct, updateGuestItem } from '../cart/guestCart';
import type { ProductListItem } from '../types/catalog';
import type { Cart, CartProduct } from '../types/commerce';
import { apiRequest, getAuthToken } from './client';

export function fetchCart(): Promise<{ data: Cart }> {
  if (!getAuthToken()) {
    return Promise.resolve({ data: guestCart() });
  }
  return apiRequest<Cart>('GET', '/cart');
}

export function addCartItem(
  product: ProductListItem | CartProduct,
  qty: number,
): Promise<{ data: Cart }> {
  if (!getAuthToken()) {
    const snapshot = 'images' in product ? toCartProduct(product) : product;
    return Promise.resolve({ data: addGuestItem(snapshot, qty) });
  }
  return apiRequest<Cart>('POST', '/cart/items', { body: { productId: product.id, qty } });
}

export function updateCartItem(itemId: string, qty: number): Promise<{ data: Cart }> {
  if (!getAuthToken()) {
    return Promise.resolve({ data: updateGuestItem(itemId, qty) });
  }
  return apiRequest<Cart>('PATCH', `/cart/items/${itemId}`, { body: { qty } });
}

export function removeCartItem(itemId: string): Promise<{ data: Cart }> {
  if (!getAuthToken()) {
    return Promise.resolve({ data: removeGuestItem(itemId) });
  }
  return apiRequest<Cart>('DELETE', `/cart/items/${itemId}`);
}
