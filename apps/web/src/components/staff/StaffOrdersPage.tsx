import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { staffOrdersApi } from '../../api/staffOrders';
import { Pagination } from '../Pagination';
import { StateBlock } from '../StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { PageMeta } from '../../types/catalog';
import type { OrderStatus, StaffOrderListItem } from '../../types/commerce';
import { formatVnd } from '../../utils/format';
import { formatDateTime, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../../utils/labels';

const STATUS_OPTIONS: Array<{ value: OrderStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: ORDER_STATUS_LABELS.pending },
  { value: 'processing', label: ORDER_STATUS_LABELS.processing },
  { value: 'shipped', label: ORDER_STATUS_LABELS.shipped },
  { value: 'delivered', label: ORDER_STATUS_LABELS.delivered },
  { value: 'cancelled', label: ORDER_STATUS_LABELS.cancelled },
];

interface StaffOrdersPageProps {
  title: string;
  listPath: string;
  api: ReturnType<typeof staffOrdersApi>;
}

/** Shared staff order list — used by both `/employee/orders` and `/admin/orders`. */
export function StaffOrdersPage({ title, listPath, api }: StaffOrdersPageProps) {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const orders = useAsync<{ items: StaffOrderListItem[]; meta: PageMeta }>(
    () => api.fetchOrders({ status, page }),
    [status, page],
  );

  return (
    <div className="page-container page orders-page">
      <h1>{title}</h1>

      <div className="staff-toolbar">
        <div className="form-field">
          <label htmlFor="order-status-filter">Trạng thái đơn hàng</label>
          <select
            id="order-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | '');
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {orders.status === 'loading' ? (
        <StateBlock title="Đang tải đơn hàng…" />
      ) : orders.status === 'error' ? (
        <StateBlock
          title="Không tải được đơn hàng"
          description={orders.error?.message}
          actionLabel="Thử lại"
          onAction={orders.reload}
        />
      ) : (orders.data?.items.length ?? 0) === 0 ? (
        <StateBlock
          title="Không có đơn hàng nào"
          description="Chưa có đơn hàng phù hợp với bộ lọc hiện tại."
        />
      ) : (
        <>
          <ul className="order-list">
            {orders.data!.items.map((order) => (
              <li key={order.id}>
                <Link className="order-card" to={`${listPath}/${order.orderNo}`}>
                  <div className="order-card__main">
                    <p className="order-card__no">{order.orderNo}</p>
                    <p className="muted">
                      {order.customerName} · {formatDateTime(order.createdAt)} · {order.itemCount}{' '}
                      sản phẩm
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
