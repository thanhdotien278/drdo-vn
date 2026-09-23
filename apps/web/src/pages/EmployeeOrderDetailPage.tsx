import { staffOrdersApi } from '../api/staffOrders';
import { StaffOrderDetailPage } from '../components/staff/StaffOrderDetailPage';

const api = staffOrdersApi('employee');

export function EmployeeOrderDetailPage() {
  return <StaffOrderDetailPage listPath="/employee/orders" api={api} />;
}
