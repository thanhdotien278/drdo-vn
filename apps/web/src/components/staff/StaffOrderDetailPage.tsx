import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiRequestError } from '../../api/client';
import type { staffOrdersApi } from '../../api/staffOrders';
import { StateBlock } from '../StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { OrderStatus, StaffOrderDetail } from '../../types/commerce';
import { formatVnd } from '../../utils/format';
import {
  formatDateTime,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/labels';

/**
 * Only the legal next moves are offered; the backend state machine remains
 * authoritative (FR-07, Story 4.2).
 */
const NEXT_ACTIONS: Record<OrderStatus, Array<{ status: OrderStatus; label: string; danger?: boolean; confirm?: string }>> = {
  pending: [
    { status: 'processing', label: 'Xác nhận xử lý' },
    { status: 'cancelled', label: 'Hủy đơn', danger: true, confirm: 'Hủy đơn hàng này? Tồn kho đã giữ sẽ được trả lại.' },
  ],
  processing: [
    { status: 'shipped', label: 'Giao hàng' },
    { status: 'cancelled', label: 'Hủy đơn', danger: true, confirm: 'Hủy đơn hàng này? Tồn kho đã giữ sẽ được trả lại.' },
  ],
  shipped: [
    { status: 'delivered', label: 'Đã giao hàng', confirm: 'Xác nhận đơn đã giao thành công? Thao tác này không thể hoàn tác.' },
  ],
  delivered: [],
  cancelled: [],
};

const INVENTORY_STATE_LABELS: Record<StaffOrderDetail['inventoryState'], string> = {
  reserved: 'Đang giữ hàng',
  deducted: 'Đã trừ kho',
  released: 'Đã trả hàng giữ',
};

interface StaffOrderDetailPageProps {
  listPath: string;
  api: ReturnType<typeof staffOrdersApi>;
}

/** Shared staff order detail — identical for `/employee/orders` and `/admin/orders`. */
export function StaffOrderDetailPage({ listPath, api }: StaffOrderDetailPageProps) {
  const { orderNo = '' } = useParams();
  const order = useAsync<StaffOrderDetail>(
    async () => (await api.fetchOrder(orderNo)).data,
    [orderNo],
  );
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  async function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    setPendingAction(true);
    try {
      await action();
      setNote('');
      order.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Thao tác thất bại');
    } finally {
      setPendingAction(false);
    }
  }

  if (order.status === 'loading') {
    return (
      <div className="page-container page">
        <StateBlock title="Đang tải đơn hàng…" />
      </div>
    );
  }

  if (order.status === 'error' || !order.data) {
    const notFound = order.error instanceof ApiRequestError && order.error.status === 404;
    return (
      <div className="page-container page">
        <StateBlock
          title={notFound ? 'Không tìm thấy đơn hàng' : 'Không tải được đơn hàng'}
          description={notFound ? undefined : order.error?.message}
          actionLabel={notFound ? undefined : 'Thử lại'}
          onAction={notFound ? undefined : order.reload}
        />
      </div>
    );
  }

  const data = order.data;
  const { shipping, totals, customer } = data;
  const actions = NEXT_ACTIONS[data.orderStatus];
  const nextPayment = data.paymentStatus === 'unpaid' ? 'paid' : 'unpaid';

  return (
    <div className="page-container page order-detail">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link to={listPath}>Đơn hàng</Link>
        <span aria-hidden="true">/</span>
        <span>{data.orderNo}</span>
      </nav>

      <div className="order-detail__header">
        <div>
          <h1>Đơn hàng {data.orderNo}</h1>
          <p className="muted">Đặt lúc {formatDateTime(data.createdAt)}</p>
        </div>
        <div className="order-card__status">
          <span className={`status status--${data.orderStatus}`}>
            {ORDER_STATUS_LABELS[data.orderStatus]}
          </span>
          <span className={`status status--pay-${data.paymentStatus}`}>
            {PAYMENT_STATUS_LABELS[data.paymentStatus]}
          </span>
        </div>
      </div>

      <div className="order-detail__layout">
        <div className="order-detail__main">
          <section className="checkout-panel" aria-labelledby="items-heading">
            <h2 id="items-heading">Sản phẩm</h2>
            <ul className="order-items">
              {data.items.map((item) => (
                <li key={item.id} className="order-item">
                  <div className="order-item__info">
                    <p className="order-item__name">{item.name}</p>
                    <p className="muted">
                      SKU: {item.sku} · {formatVnd(item.unitPrice)} × {item.qty}
                    </p>
                  </div>
                  <p className="price price--current">{formatVnd(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="summary-rows">
              <div className="summary-row">
                <dt>Tạm tính</dt>
                <dd>{formatVnd(totals.subtotal)}</dd>
              </div>
              {totals.discountAmount > 0 ? (
                <div className="summary-row">
                  <dt>
                    Giảm giá
                    {totals.couponRef ? ` (${totals.couponRef.code})` : ''}
                  </dt>
                  <dd>-{formatVnd(totals.discountAmount)}</dd>
                </div>
              ) : null}
              {totals.pointsDiscountAmount > 0 ? (
                <div className="summary-row">
                  <dt>Điểm thưởng ({totals.pointsRedeemed} điểm)</dt>
                  <dd>-{formatVnd(totals.pointsDiscountAmount)}</dd>
                </div>
              ) : null}
              <div className="summary-row">
                <dt>Phí vận chuyển</dt>
                <dd>{formatVnd(totals.shippingFee)}</dd>
              </div>
              <div className="summary-row summary-row--total">
                <dt>Tổng cộng</dt>
                <dd>{formatVnd(totals.grandTotal)}</dd>
              </div>
            </dl>
          </section>

          <section className="checkout-panel" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading">Trạng thái đơn hàng</h2>
            <ol className="timeline">
              {data.timeline.map((event, index) => (
                <li key={index} className="timeline__item">
                  <span className="timeline__dot" aria-hidden="true" />
                  <div>
                    <p>
                      <strong>{ORDER_STATUS_LABELS[event.toStatus]}</strong>
                    </p>
                    {event.reason ? <p className="muted">{event.reason}</p> : null}
                    <p className="muted">{formatDateTime(event.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="order-detail__side">
          <section className="checkout-panel" aria-labelledby="actions-heading">
            <h2 id="actions-heading">Thao tác</h2>
            <div className="form-field">
              <label htmlFor="action-note">Ghi chú / lý do (không bắt buộc)</label>
              <input
                id="action-note"
                type="text"
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: đã gọi xác nhận với khách"
              />
            </div>
            {actionError ? (
              <p className="error-text" role="alert">
                {actionError}
              </p>
            ) : null}
            {actions.length > 0 ? (
              <div className="order-actions">
                {actions.map((action) => (
                  <button
                    key={action.status}
                    type="button"
                    className={action.danger ? 'button button--danger' : 'button button--primary'}
                    disabled={pendingAction}
                    onClick={() => {
                      if (action.confirm && !window.confirm(action.confirm)) return;
                      void runAction(() =>
                        api.updateStatus(data.orderNo, action.status, note.trim()),
                      );
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Đơn hàng đã ở trạng thái cuối — không còn thao tác.</p>
            )}
          </section>

          <section className="checkout-panel" aria-labelledby="shipping-heading">
            <h2 id="shipping-heading">Giao hàng</h2>
            <p>
              <strong>{shipping.fullName}</strong>
            </p>
            <p className="muted">{shipping.phone}</p>
            <p className="muted">
              {shipping.line1}
              {shipping.line2 ? `, ${shipping.line2}` : ''}, {shipping.ward}, {shipping.district},{' '}
              {shipping.province}
            </p>
            <p className="muted">{shipping.contactEmail}</p>
            {data.notesCustomer ? <p className="muted">Ghi chú: {data.notesCustomer}</p> : null}
            {customer ? (
              <p className="muted">
                Tài khoản: {customer.fullName} · {customer.email}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </p>
            ) : null}
            {data.notesInternal ? <p className="muted">Nội bộ: {data.notesInternal}</p> : null}
          </section>

          <section className="checkout-panel" aria-labelledby="payment-heading">
            <h2 id="payment-heading">Thanh toán</h2>
            <p>{PAYMENT_METHOD_LABELS[data.paymentMethod]}</p>
            <p className="muted">{PAYMENT_STATUS_LABELS[data.paymentStatus]}</p>
            {data.paidAt ? (
              <p className="muted">Thanh toán lúc {formatDateTime(data.paidAt)}</p>
            ) : null}
            <p className="muted">Tồn kho: {INVENTORY_STATE_LABELS[data.inventoryState]}</p>
            <button
              type="button"
              className="button button--outline"
              disabled={pendingAction}
              onClick={() => {
                const label =
                  nextPayment === 'paid'
                    ? 'Xác nhận đã nhận thanh toán cho đơn này?'
                    : 'Hoàn tác trạng thái thanh toán về chưa thanh toán?';
                if (!window.confirm(label)) return;
                void runAction(() =>
                  api.updatePayment(data.orderNo, nextPayment, note.trim()),
                );
              }}
            >
              {nextPayment === 'paid' ? 'Xác nhận đã thanh toán' : 'Đặt lại chưa thanh toán'}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
