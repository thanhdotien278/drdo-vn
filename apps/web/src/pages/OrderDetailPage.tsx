import { Link, useLocation, useParams } from 'react-router-dom';
import { fetchOrder } from '../api/orders';
import { ApiRequestError } from '../api/client';
import { StateBlock } from '../components/StateBlock';
import { useAsync } from '../hooks/useAsync';
import type { OrderDetail } from '../types/commerce';
import { formatVnd } from '../utils/format';
import {
  formatDateTime,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../utils/labels';

export function OrderDetailPage() {
  const { orderNo = '' } = useParams();
  const location = useLocation();
  const order = useAsync<OrderDetail>(async () => (await fetchOrder(orderNo)).data, [orderNo]);
  // Set by checkout when the opt-in "save this address" write failed.
  const addressSaveFailed =
    (location.state as { addressSaveFailed?: boolean } | null)?.addressSaveFailed === true;

  if (order.status === 'loading') {
    return <StateBlock title="Đang tải đơn hàng…" />;
  }

  if (order.status === 'error' || !order.data) {
    const notFound = order.error instanceof ApiRequestError && order.error.status === 404;
    return (
      <StateBlock
        title={notFound ? 'Không tìm thấy đơn hàng' : 'Không tải được đơn hàng'}
        description={notFound ? undefined : order.error?.message}
        actionLabel={notFound ? undefined : 'Thử lại'}
        onAction={notFound ? undefined : order.reload}
      />
    );
  }

  const data = order.data;
  const { shipping, totals } = data;

  return (
    <div className="order-detail">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link to="/orders">Đơn hàng của tôi</Link>
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

      {addressSaveFailed ? (
        <p className="error-text" role="alert">
          Đơn hàng đã được tạo, nhưng không lưu được địa chỉ vào sổ địa chỉ.
        </p>
      ) : null}

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
          </section>

          <section className="checkout-panel" aria-labelledby="payment-heading">
            <h2 id="payment-heading">Thanh toán</h2>
            <p>{PAYMENT_METHOD_LABELS[data.paymentMethod]}</p>
            <p className="muted">{PAYMENT_STATUS_LABELS[data.paymentStatus]}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
