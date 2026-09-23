import { staffOrdersApi } from '../../api/staffOrders';
import { StaffOrdersPage } from '../../components/staff/StaffOrdersPage';

const api = staffOrdersApi('admin');

export function AdminOrdersPage() {
  return <StaffOrdersPage title="Đơn hàng — Quản trị" listPath="/admin/orders" api={api} />;
}
