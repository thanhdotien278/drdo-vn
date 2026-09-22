import type { PageMeta } from '../types/catalog';
import type {
  OrderStatus,
  PaymentStatus,
  StaffOrderDetail,
  StaffOrderListItem,
} from '../types/commerce';
import { apiGet, apiRequest } from './client';

export interface EmployeeOrderQuery {
  status?: OrderStatus | '';
  page?: number;
  limit?: number;
}

export async function fetchEmployeeOrders(
  query: EmployeeOrderQuery = {},
): Promise<{ items: StaffOrderListItem[]; meta: PageMeta }> {
  const result = await apiGet<StaffOrderListItem[]>('/employee/orders', {
    status: query.status || undefined,
    page: query.page,
    limit: query.limit ?? 10,
  });
  return { items: result.data, meta: result.meta as PageMeta };
}

export function fetchEmployeeOrder(orderNo: string): Promise<{ data: StaffOrderDetail }> {
  return apiGet<StaffOrderDetail>(`/employee/orders/${encodeURIComponent(orderNo)}`);
}

export function updateEmployeeOrderStatus(
  orderNo: string,
  status: OrderStatus,
  note?: string,
): Promise<{ data: StaffOrderDetail }> {
  return apiRequest<StaffOrderDetail>('PATCH', `/employee/orders/${encodeURIComponent(orderNo)}/status`, {
    body: { status, ...(note ? { note } : {}) },
  });
}

export function updateEmployeeOrderPayment(
  orderNo: string,
  paymentStatus: PaymentStatus,
  note?: string,
): Promise<{ data: StaffOrderDetail }> {
  return apiRequest<StaffOrderDetail>(
    'PATCH',
    `/employee/orders/${encodeURIComponent(orderNo)}/payment`,
    { body: { paymentStatus, ...(note ? { note } : {}) } },
  );
}
