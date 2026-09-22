import type { Cart } from '../types/commerce';
import { apiRequest } from './client';

export function fetchCart(): Promise<{ data: Cart }> {
  return apiRequest<Cart>('GET', '/cart');
}

export function addCartItem(productId: string, qty: number): Promise<{ data: Cart }> {
  return apiRequest<Cart>('POST', '/cart/items', { body: { productId, qty } });
}

export function updateCartItem(itemId: string, qty: number): Promise<{ data: Cart }> {
  return apiRequest<Cart>('PATCH', `/cart/items/${itemId}`, { body: { qty } });
}

export function removeCartItem(itemId: string): Promise<{ data: Cart }> {
  return apiRequest<Cart>('DELETE', `/cart/items/${itemId}`);
}
