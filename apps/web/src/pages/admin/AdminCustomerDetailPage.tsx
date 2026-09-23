import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchAdminCustomer, setAdminCustomerStatus } from '../../api/admin';
import { ApiRequestError } from '../../api/client';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminCustomerDetail } from '../../types/admin';
import { formatVnd } from '../../utils/format';
import { formatDateTime, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../../utils/labels';

export function AdminCustomerDetailPage() {
  const { id = '' } = useParams();
  const detail = useAsync<AdminCustomerDetail>(
    async () => (await fetchAdminCustomer(id)).data,
    [id],
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleBlock() {
    const customer = detail.data?.customer;
    if (!customer) return;
    const next = customer.status === 'blocked' ? 'active' : 'blocked';
    const question =
      next === 'blocked'
        ? `Khóa tài khoản "${customer.fullName}"? Khách sẽ không đăng nhập được nữa.`
        : `Mở khóa tài khoản "${customer.fullName}"?`;
    if (!window.confirm(question)) return;
    setActionError(null);
    setBusy(true);
    try {
      await setAdminCustomerStatus(customer.id, next);
      detail.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (detail.status === 'loading') {
    return (
      <div className="page">
        <StateBlock title="Đang tải khách hàng…" />
      </div>
    );
  }

  if (detail.status === 'error' || !detail.data) {
    const notFound = detail.error instanceof ApiRequestError && detail.error.status === 404;
    return (
      <div className="page">
        <StateBlock
          title={notFound ? 'Không tìm thấy khách hàng' : 'Không tải được khách hàng'}
          description={notFound ? undefined : detail.error?.message}
          actionLabel={notFound ? undefined : 'Thử lại'}
          onAction={notFound ? undefined : detail.reload}
        />
      </div>
    );
  }

  const { customer, orders } = detail.data;

  return (
    <div className="page admin-page">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link to="/admin/customers">Khách hàng</Link>
        <span aria-hidden="true">/</span>
        <span>{customer.fullName}</span>
      </nav>

      <div className="admin-page__header">
        <div>
          <h1>{customer.fullName}</h1>
          <p className="muted">
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ''} · Đăng ký{' '}
            {formatDateTime(customer.createdAt)}
          </p>
        </div>
        <button
          type="button"
          className={customer.status === 'blocked' ? 'button button--outline' : 'button button--danger'}
          disabled={busy}
          onClick={() => void toggleBlock()}
        >
          {customer.status === 'blocked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
        </button>
      </div>

      {actionError ? (
        <p className="error-text" role="alert">
          {actionError}
        </p>
      ) : null}

      <section className="checkout-panel" aria-labelledby="customer-orders-heading">
        <h2 id="customer-orders-heading">Lịch sử đơn hàng ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="muted">Khách hàng chưa có đơn hàng nào.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Ngày đặt</th>
                <th>Trạng thái</th>
                <th>Thanh toán</th>
                <th>Tổng</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/admin/orders/${order.orderNo}`}>{order.orderNo}</Link>
                  </td>
                  <td>{formatDateTime(order.createdAt)}</td>
                  <td>
                    <span className={`status status--${order.orderStatus}`}>
                      {ORDER_STATUS_LABELS[order.orderStatus]}
                    </span>
                  </td>
                  <td>
                    <span className={`status status--pay-${order.paymentStatus}`}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </td>
                  <td>{formatVnd(order.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
