import type { CheckoutInput, OrderDetail, OrderListItem, OrderPreview } from '../types/commerce';
import type { PageMeta } from '../types/catalog';
import { apiGet, apiRequest } from './client';

export function previewOrder(pointsToRedeem = 0): Promise<{ data: OrderPreview }> {
  return apiRequest<OrderPreview>('POST', '/orders/preview', { body: { pointsToRedeem } });
}

export function createOrder(input: CheckoutInput): Promise<{ data: OrderDetail }> {
  return apiRequest<OrderDetail>('POST', '/orders', { body: input });
}

export async function fetchOrders(
  page = 1,
  limit = 10,
): Promise<{ items: OrderListItem[]; meta: PageMeta }> {
  const result = await apiGet<OrderListItem[]>('/orders', { page, limit });
  return { items: result.data, meta: result.meta as PageMeta };
}

export function fetchOrder(orderNo: string): Promise<{ data: OrderDetail }> {
  return apiGet<OrderDetail>(`/orders/${encodeURIComponent(orderNo)}`);
}
