import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrders } from '../api/orders';
import { Pagination } from '../components/Pagination';
import { StateBlock } from '../components/StateBlock';
import { useAsync } from '../hooks/useAsync';
import type { OrderListItem } from '../types/commerce';
import type { PageMeta } from '../types/catalog';
import { formatVnd } from '../utils/format';
import { formatDateTime, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../utils/labels';

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const orders = useAsync<{ items: OrderListItem[]; meta: PageMeta }>(
    () => fetchOrders(page),
    [page],
  );

  if (orders.status === 'loading') {
    return <StateBlock title="Đang tải đơn hàng…" />;
  }

  if (orders.status === 'error') {
    return (
      <StateBlock
        title="Không tải được đơn hàng"
        description={orders.error?.message}
        actionLabel="Thử lại"
        onAction={orders.reload}
      />
    );
  }

  const items = orders.data?.items ?? [];

  return (
    <div className="orders-page">
      <h1>Đơn hàng của tôi</h1>

      {items.length === 0 ? (
        <>
          <StateBlock
            title="Chưa có đơn hàng nào"
            description="Đơn hàng của bạn sẽ xuất hiện ở đây sau khi đặt hàng."
          />
          <p className="cart-empty__cta">
            <Link className="button button--primary" to="/products">
              Tiếp tục mua sắm
            </Link>
          </p>
        </>
      ) : (
        <>
          <ul className="order-list">
            {items.map((order) => (
              <li key={order.id}>
                <Link className="order-card" to={`/orders/${order.orderNo}`}>
                  <div className="order-card__main">
                    <p className="order-card__no">{order.orderNo}</p>
                    <p className="muted">
                      {formatDateTime(order.createdAt)} · {order.itemCount} sản phẩm
                    </p>
                  </div>
                  <div className="order-card__status">
                    <span className={`status status--${order.orderStatus}`}>
                      {ORDER_STATUS_LABELS[order.orderStatus]}
                    </span>
                    <span className={`status status--pay-${order.paymentStatus}`}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </div>
                  <p className="order-card__total price price--current">
                    {formatVnd(order.grandTotal)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {orders.data && orders.data.meta.totalPages > 1 ? (
            <Pagination
              meta={orders.data.meta}
              onPageChange={(next) => {
                setPage(next);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
