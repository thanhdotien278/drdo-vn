import type { PageMeta } from '../types/catalog';
import type {
  OrderStatus,
  PaymentStatus,
  StaffOrderDetail,
  StaffOrderListItem,
} from '../types/commerce';
import { apiGet, apiRequest } from './client';

/**
 * Epic 4/5 — the same order endpoints exist under `/employee` and `/admin`
 * with identical semantics; the area only changes the URL prefix.
 */
export type StaffArea = 'employee' | 'admin';

export interface StaffOrderQuery {
  status?: OrderStatus | '';
  page?: number;
  limit?: number;
}

export function staffOrdersApi(area: StaffArea) {
  const base = `/${area}/orders`;
  return {
    async fetchOrders(
      query: StaffOrderQuery = {},
    ): Promise<{ items: StaffOrderListItem[]; meta: PageMeta }> {
      const result = await apiGet<StaffOrderListItem[]>(base, {
        status: query.status || undefined,
        page: query.page,
        limit: query.limit ?? 10,
      });
      return { items: result.data, meta: result.meta as PageMeta };
    },

    fetchOrder(orderNo: string): Promise<{ data: StaffOrderDetail }> {
      return apiGet<StaffOrderDetail>(`${base}/${encodeURIComponent(orderNo)}`);
    },

    updateStatus(
      orderNo: string,
      status: OrderStatus,
      note?: string,
    ): Promise<{ data: StaffOrderDetail }> {
      return apiRequest<StaffOrderDetail>('PATCH', `${base}/${encodeURIComponent(orderNo)}/status`, {
        body: { status, ...(note ? { note } : {}) },
      });
    },

    updatePayment(
      orderNo: string,
      paymentStatus: PaymentStatus,
      note?: string,
    ): Promise<{ data: StaffOrderDetail }> {
      return apiRequest<StaffOrderDetail>(
        'PATCH',
        `${base}/${encodeURIComponent(orderNo)}/payment`,
        { body: { paymentStatus, ...(note ? { note } : {}) } },
      );
    },
  };
}
