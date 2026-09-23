import { staffOrdersApi } from '../../api/staffOrders';
import { StaffOrderDetailPage } from '../../components/staff/StaffOrderDetailPage';

const api = staffOrdersApi('admin');

export function AdminOrderDetailPage() {
  return <StaffOrderDetailPage listPath="/admin/orders" api={api} />;
}
