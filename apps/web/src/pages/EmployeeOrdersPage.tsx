import { staffOrdersApi } from '../api/staffOrders';
import { StaffOrdersPage } from '../components/staff/StaffOrdersPage';

const api = staffOrdersApi('employee');

export function EmployeeOrdersPage() {
  return <StaffOrdersPage title="Đơn hàng — Nhân viên" listPath="/employee/orders" api={api} />;
}
