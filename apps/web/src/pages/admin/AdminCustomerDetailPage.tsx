import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  adjustAdminCustomerPoints,
  fetchAdminCustomer,
  fetchAdminCustomerLoyalty,
  setAdminCustomerStatus,
} from '../../api/admin';
import { ApiRequestError } from '../../api/client';
import { Pagination } from '../../components/Pagination';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminCustomerDetail } from '../../types/admin';
import type { AdminCustomerLoyalty } from '../../types/loyalty';
import type { PageMeta } from '../../types/catalog';
import { formatVnd } from '../../utils/format';
import {
  formatDateTime,
  LOYALTY_KIND_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/labels';

export function AdminCustomerDetailPage() {
  const { id = '' } = useParams();
  const detail = useAsync<AdminCustomerDetail>(
    async () => (await fetchAdminCustomer(id)).data,
    [id],
  );
  const [loyaltyPage, setLoyaltyPage] = useState(1);
  const loyalty = useAsync<{ data: AdminCustomerLoyalty; meta: PageMeta }>(
    () => fetchAdminCustomerLoyalty(id, loyaltyPage),
    [id, loyaltyPage],
  );
  const [pointsInput, setPointsInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [adjusting, setAdjusting] = useState(false);
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

  async function handleAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const points = Number(pointsInput);
    if (!Number.isInteger(points) || points === 0) {
      setActionError('Số điểm điều chỉnh phải là số nguyên khác 0');
      return;
    }
    if (!reasonInput.trim()) {
      setActionError('Vui lòng nhập lý do điều chỉnh');
      return;
    }
    setActionError(null);
    setAdjusting(true);
    try {
      await adjustAdminCustomerPoints(id, { points, reason: reasonInput.trim() });
      setPointsInput('');
      setReasonInput('');
      loyalty.reload();
    } catch (error) {
      setActionError(error instanceof ApiRequestError ? error.message : 'Điều chỉnh thất bại');
    } finally {
      setAdjusting(false);
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

      <section className="checkout-panel" aria-labelledby="customer-loyalty-heading">
        <h2 id="customer-loyalty-heading">Điểm thưởng</h2>
        {loyalty.status === 'loading' ? (
          <StateBlock title="Đang tải điểm thưởng…" />
        ) : loyalty.status === 'error' || !loyalty.data ? (
          <StateBlock
            title="Không tải được điểm thưởng"
            description={loyalty.error?.message}
            actionLabel="Thử lại"
            onAction={loyalty.reload}
          />
        ) : (
          <>
            <div className="metric-grid">
              <div className="metric-card">
                <p className="metric-card__label">Số dư điểm</p>
                <p className="metric-card__value">
                  {loyalty.data.data.summary.balance.toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-card__label">Hạng thành viên</p>
                <p className="metric-card__value">
                  {loyalty.data.data.summary.tier?.name ?? loyalty.data.data.summary.tierCode}
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-card__label">Điểm tích lũy</p>
                <p className="metric-card__value">
                  {loyalty.data.data.summary.lifetimeEarned.toLocaleString('vi-VN')}
                </p>
              </div>
            </div>

            <form className="staff-toolbar" onSubmit={handleAdjust}>
              <div className="form-field">
                <label htmlFor="adjust-points">Điểm điều chỉnh (+/−)</label>
                <input
                  id="adjust-points"
                  type="number"
                  step={1}
                  value={pointsInput}
                  onChange={(event) => setPointsInput(event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="adjust-reason">Lý do (bắt buộc)</label>
                <input
                  id="adjust-reason"
                  value={reasonInput}
                  maxLength={500}
                  onChange={(event) => setReasonInput(event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <button type="submit" className="button button--primary" disabled={adjusting}>
                  {adjusting ? 'Đang lưu…' : 'Điều chỉnh điểm'}
                </button>
              </div>
            </form>

            {loyalty.data.data.items.length === 0 ? (
              <p className="muted">Chưa có giao dịch điểm nào.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Loại</th>
                    <th>Đơn hàng</th>
                    <th>Điểm</th>
                    <th>Số dư sau</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {loyalty.data.data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td className="muted">{formatDateTime(entry.createdAt)}</td>
                      <td>{LOYALTY_KIND_LABELS[entry.kind]}</td>
                      <td>
                        {entry.orderNo ? (
                          <Link to={`/admin/orders/${entry.orderNo}`}>{entry.orderNo}</Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {entry.delta > 0
                          ? `+${entry.delta.toLocaleString('vi-VN')}`
                          : entry.delta.toLocaleString('vi-VN')}
                      </td>
                      <td>{entry.balanceAfter.toLocaleString('vi-VN')}</td>
                      <td className="muted">{entry.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {loyalty.data.meta.totalPages > 1 ? (
              <Pagination meta={loyalty.data.meta} onPageChange={setLoyaltyPage} />
            ) : null}
          </>
        )}
      </section>

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
