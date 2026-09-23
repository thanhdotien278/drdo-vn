import { Link } from 'react-router-dom';
import { fetchAdminDashboard } from '../../api/admin';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminDashboard } from '../../types/admin';
import { formatVnd } from '../../utils/format';
import { ORDER_STATUS_LABELS } from '../../utils/labels';

export function AdminDashboardPage() {
  const dashboard = useAsync<AdminDashboard>(async () => (await fetchAdminDashboard()).data, []);

  if (dashboard.status === 'loading') {
    return (
      <div className="page">
        <StateBlock title="Đang tải tổng quan…" />
      </div>
    );
  }

  if (dashboard.status === 'error' || !dashboard.data) {
    return (
      <div className="page">
        <StateBlock
          title="Không tải được tổng quan"
          description={dashboard.error?.message}
          actionLabel="Thử lại"
          onAction={dashboard.reload}
        />
      </div>
    );
  }

  const data = dashboard.data;

  return (
    <div className="page admin-dashboard">
      <h1>Tổng quan</h1>

      <div className="metric-grid">
        <div className="metric-card">
          <p className="metric-card__label">Đơn hôm nay</p>
          <p className="metric-card__value">{data.orders.today}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card__label">Đơn tuần này</p>
          <p className="metric-card__value">{data.orders.thisWeek}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card__label">Doanh thu hôm nay</p>
          <p className="metric-card__value">{formatVnd(data.revenue.today)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card__label">Doanh thu tuần này</p>
          <p className="metric-card__value">{formatVnd(data.revenue.thisWeek)}</p>
        </div>
      </div>

      <section className="checkout-panel" aria-labelledby="status-heading">
        <h2 id="status-heading">Đơn hàng theo trạng thái</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Trạng thái</th>
              <th>Số đơn</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.orders.byStatus).map(([status, count]) => (
              <tr key={status}>
                <td>
                  <span className={`status status--${status}`}>
                    {ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]}
                  </span>
                </td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="checkout-panel" aria-labelledby="low-stock-heading">
        <h2 id="low-stock-heading">Sản phẩm sắp hết hàng</h2>
        {data.lowStockProducts.length === 0 ? (
          <p className="muted">Không có sản phẩm nào dưới ngưỡng tồn kho.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>SKU</th>
                <th>Còn lại</th>
                <th>Ngưỡng</th>
              </tr>
            </thead>
            <tbody>
              {data.lowStockProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link to={`/admin/products/${product.id}/edit`}>{product.name}</Link>
                  </td>
                  <td>{product.sku}</td>
                  <td>{product.availableStock}</td>
                  <td>{product.lowStockThreshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
