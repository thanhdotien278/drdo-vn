import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLoyaltyHistory, fetchLoyaltySummary } from '../api/loyalty';
import { Pagination } from '../components/Pagination';
import { StateBlock } from '../components/StateBlock';
import { useAsync } from '../hooks/useAsync';
import type { PageMeta } from '../types/catalog';
import type { LoyaltyEntry, LoyaltySummary } from '../types/loyalty';
import { formatVnd } from '../utils/format';
import { formatDateTime, LOYALTY_KIND_LABELS } from '../utils/labels';

/** Epic 8 — customer loyalty: derived balance, current/next tier, ledger history. */
export function LoyaltyPage() {
  const [page, setPage] = useState(1);
  const summary = useAsync<LoyaltySummary>(async () => (await fetchLoyaltySummary()).data, []);
  const history = useAsync<{ items: LoyaltyEntry[]; meta: PageMeta }>(
    () => fetchLoyaltyHistory(page),
    [page],
  );

  if (summary.status === 'loading') {
    return (
      <div className="page container">
        <h1>Điểm thưởng</h1>
        <StateBlock title="Đang tải điểm thưởng…" />
      </div>
    );
  }

  if (summary.status === 'error' || !summary.data) {
    return (
      <div className="page container">
        <h1>Điểm thưởng</h1>
        <StateBlock
          title="Không tải được điểm thưởng"
          description={summary.error?.message}
          actionLabel="Thử lại"
          onAction={summary.reload}
        />
      </div>
    );
  }

  const data = summary.data;

  return (
    <div className="page container">
      <h1>Điểm thưởng</h1>

      <div className="metric-grid">
        <div className="metric-card">
          <p className="metric-card__label">Số dư điểm</p>
          <p className="metric-card__value">{data.balance.toLocaleString('vi-VN')}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card__label">Hạng thành viên</p>
          <p className="metric-card__value">{data.tier?.name ?? data.tierCode}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card__label">Điểm tích lũy</p>
          <p className="metric-card__value">{data.lifetimeEarned.toLocaleString('vi-VN')}</p>
        </div>
        <div className="metric-card">
          <p className="metric-card__label">Hạng tiếp theo</p>
          <p className="metric-card__value">
            {data.nextTier ? data.nextTier.name : 'Tối đa'}
          </p>
          {data.nextTier ? (
            <p className="muted">
              Còn {data.pointsToNextTier.toLocaleString('vi-VN')} điểm nữa lên {data.nextTier.name}
            </p>
          ) : null}
        </div>
      </div>

      {data.tier?.freeShippingThreshold === 0 ? (
        <p className="muted">Hạng {data.tier.name}: miễn phí vận chuyển mọi đơn hàng.</p>
      ) : data.tier?.freeShippingThreshold != null ? (
        <p className="muted">
          Hạng {data.tier.name}: miễn phí vận chuyển cho đơn từ{' '}
          {formatVnd(data.tier.freeShippingThreshold)}.
        </p>
      ) : null}

      <section className="checkout-panel" aria-labelledby="loyalty-history-heading">
        <h2 id="loyalty-history-heading">Lịch sử điểm</h2>
        {history.status === 'loading' ? (
          <StateBlock title="Đang tải lịch sử…" />
        ) : history.status === 'error' ? (
          <StateBlock
            title="Không tải được lịch sử điểm"
            description={history.error?.message}
            actionLabel="Thử lại"
            onAction={history.reload}
          />
        ) : (history.data?.items.length ?? 0) === 0 ? (
          <p className="muted">
            Chưa có giao dịch điểm nào. Điểm được tích khi đơn hàng chuyển sang trạng thái giao hàng.
          </p>
        ) : (
          <>
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
                {history.data!.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="muted">{formatDateTime(entry.createdAt)}</td>
                    <td>{LOYALTY_KIND_LABELS[entry.kind]}</td>
                    <td>
                      {entry.orderNo ? (
                        <Link to={`/orders/${entry.orderNo}`}>{entry.orderNo}</Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{entry.delta > 0 ? `+${entry.delta.toLocaleString('vi-VN')}` : entry.delta.toLocaleString('vi-VN')}</td>
                    <td>{entry.balanceAfter.toLocaleString('vi-VN')}</td>
                    <td className="muted">{entry.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.data && history.data.meta.totalPages > 1 ? (
              <Pagination meta={history.data.meta} onPageChange={setPage} />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
