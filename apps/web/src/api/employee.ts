import type { PageMeta } from '../types/catalog';
import type {
  OrderStatus,
  PaymentStatus,
  StaffOrderDetail,
  StaffOrderListItem,
} from '../types/commerce';
import { staffOrdersApi, type StaffOrderQuery } from './staffOrders';

const api = staffOrdersApi('employee');

export type EmployeeOrderQuery = StaffOrderQuery;

export function fetchEmployeeOrders(
  query: EmployeeOrderQuery = {},
): Promise<{ items: StaffOrderListItem[]; meta: PageMeta }> {
  return api.fetchOrders(query);
}

export function fetchEmployeeOrder(orderNo: string): Promise<{ data: StaffOrderDetail }> {
  return api.fetchOrder(orderNo);
}

export function updateEmployeeOrderStatus(
  orderNo: string,
  status: OrderStatus,
  note?: string,
): Promise<{ data: StaffOrderDetail }> {
  return api.updateStatus(orderNo, status, note);
}

export function updateEmployeeOrderPayment(
  orderNo: string,
  paymentStatus: PaymentStatus,
  note?: string,
): Promise<{ data: StaffOrderDetail }> {
  return api.updatePayment(orderNo, paymentStatus, note);
}
