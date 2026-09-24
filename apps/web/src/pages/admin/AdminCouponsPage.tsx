import { useState, type FormEvent } from 'react';
import { ApiRequestError } from '../../api/client';
import {
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCoupons,
  fetchAdminPromotions,
  fetchCouponRedemptions,
  updateAdminCoupon,
  type AdminStatusFilter,
} from '../../api/promotions';
import { Pagination } from '../../components/Pagination';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { PageMeta } from '../../types/catalog';
import type { AdminCoupon, AdminPromotion, CouponRedemption } from '../../types/promotion';
import { formatVnd } from '../../utils/format';
import { formatDateTime } from '../../utils/labels';

const STATUS_OPTIONS: Array<{ value: AdminStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang bật' },
  { value: 'inactive', label: 'Đang tắt' },
  { value: 'deleted', label: 'Đã xóa' },
];

interface CouponFormState {
  code: string;
  promotionId: string;
  usageLimitTotal: string;
  usageLimitPerCustomer: string;
  isActive: boolean;
}

const EMPTY_FORM: CouponFormState = {
  code: '',
  promotionId: '',
  usageLimitTotal: '',
  usageLimitPerCustomer: '',
  isActive: true,
};

function fromCoupon(coupon: AdminCoupon): CouponFormState {
  return {
    code: coupon.code,
    promotionId: coupon.promotionId,
    usageLimitTotal: coupon.usageLimitTotal != null ? String(coupon.usageLimitTotal) : '',
    usageLimitPerCustomer:
      coupon.usageLimitPerCustomer != null ? String(coupon.usageLimitPerCustomer) : '',
    isActive: coupon.isActive,
  };
}

const limitOrNull = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

/** Epic 9 — coupon management: issue/toggle/delete codes and inspect redemptions. */
export function AdminCouponsPage() {
  const [status, setStatus] = useState<AdminStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [historyFor, setHistoryFor] = useState<AdminCoupon | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const coupons = useAsync<{ items: AdminCoupon[]; meta: PageMeta }>(
    () => fetchAdminCoupons({ status, page }),
    [status, page],
  );
  const promotions = useAsync<AdminPromotion[]>(
    async () => (await fetchAdminPromotions({ status: 'active', limit: 48 })).items,
    [],
  );
  const redemptions = useAsync<{ items: CouponRedemption[]; meta: PageMeta } | null>(
    async () => (historyFor ? fetchCouponRedemptions(historyFor.id, historyPage) : null),
    [historyFor?.id, historyPage],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(coupon: AdminCoupon) {
    setEditing(coupon);
    setForm(fromCoupon(coupon));
    setFormOpen(true);
  }

  function openHistory(coupon: AdminCoupon) {
    setHistoryFor(coupon);
    setHistoryPage(1);
  }

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      coupons.reload();
    } catch (error) {
      setActionError(error instanceof ApiRequestError ? error.message : 'Thao tác thất bại');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const fields = {
      code: form.code.trim(),
      promotionId: form.promotionId,
      usageLimitTotal: limitOrNull(form.usageLimitTotal),
      usageLimitPerCustomer: limitOrNull(form.usageLimitPerCustomer),
      isActive: form.isActive,
    };
    const action = editing ? updateAdminCoupon(editing.id, fields) : createAdminCoupon(fields);
    action
      .then(() => {
        setFormOpen(false);
        setEditing(null);
        coupons.reload();
      })
      .catch((error: unknown) => {
        setActionError(error instanceof ApiRequestError ? error.message : 'Lưu mã thất bại');
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="page admin-page">
      <div className="admin-page__header">
        <h1>Mã giảm giá</h1>
        <button type="button" className="button button--primary" onClick={openCreate}>
          Thêm mã
        </button>
      </div>

      <div className="staff-toolbar">
        <div className="form-field">
          <label htmlFor="coupon-status-filter">Trạng thái</label>
          <select
            id="coupon-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AdminStatusFilter);
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

      {actionError ? (
        <p className="error-text" role="alert">
          {actionError}
        </p>
      ) : null}

      {formOpen ? (
        <form className="admin-panel" onSubmit={handleSubmit}>
          <h2>{editing ? 'Sửa mã giảm giá' : 'Thêm mã giảm giá'}</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="coupon-code">Mã</label>
              <input
                id="coupon-code"
                required
                maxLength={50}
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="coupon-promotion">Chương trình</label>
              <select
                id="coupon-promotion"
                required
                value={form.promotionId}
                onChange={(event) => setForm({ ...form, promotionId: event.target.value })}
              >
                <option value="" disabled>
                  Chọn chương trình
                </option>
                {(promotions.data ?? []).map((promotion) => (
                  <option key={promotion.id} value={promotion.id}>
                    {promotion.name}
                  </option>
                ))}
                {editing &&
                form.promotionId &&
                !(promotions.data ?? []).some((promo) => promo.id === form.promotionId) ? (
                  <option value={form.promotionId}>{editing.promotionName || 'Hiện tại'}</option>
                ) : null}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="coupon-total-limit">Giới hạn tổng lượt dùng (trống = không)</label>
              <input
                id="coupon-total-limit"
                type="number"
                min={1}
                value={form.usageLimitTotal}
                onChange={(event) => setForm({ ...form, usageLimitTotal: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="coupon-customer-limit">Giới hạn mỗi khách (trống = không)</label>
              <input
                id="coupon-customer-limit"
                type="number"
                min={1}
                value={form.usageLimitPerCustomer}
                onChange={(event) =>
                  setForm({ ...form, usageLimitPerCustomer: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label className="checkbox" htmlFor="coupon-active">
                <input
                  id="coupon-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Đang bật
              </label>
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Đang lưu…' : 'Lưu mã'}
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      {coupons.status === 'loading' ? (
        <StateBlock title="Đang tải mã giảm giá…" />
      ) : coupons.status === 'error' ? (
        <StateBlock
          title="Không tải được mã giảm giá"
          description={coupons.error?.message}
          actionLabel="Thử lại"
          onAction={coupons.reload}
        />
      ) : (coupons.data?.items.length ?? 0) === 0 ? (
        <StateBlock title="Chưa có mã" description="Tạo mã giảm giá gắn vào một chương trình." />
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Chương trình</th>
                <th>Giới hạn</th>
                <th>Đã dùng</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {coupons.data!.items.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <strong>{coupon.code}</strong>
                  </td>
                  <td className="muted">{coupon.promotionName || '—'}</td>
                  <td className="muted">
                    {coupon.usageLimitTotal != null ? `Tổng ${coupon.usageLimitTotal}` : '∞'}
                    {' · '}
                    {coupon.usageLimitPerCustomer != null
                      ? `${coupon.usageLimitPerCustomer}/khách`
                      : '∞/khách'}
                  </td>
                  <td>{coupon.usageCount}</td>
                  <td>
                    {coupon.isDeleted ? (
                      <span className="status status--cancelled">Đã xóa</span>
                    ) : coupon.isActive ? (
                      <span className="status status--delivered">Đang bật</span>
                    ) : (
                      <span className="status status--pending">Đang tắt</span>
                    )}
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => openHistory(coupon)}
                      >
                        Lượt dùng
                      </button>
                      {!coupon.isDeleted ? (
                        <>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => openEdit(coupon)}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() =>
                              void run(() =>
                                updateAdminCoupon(coupon.id, { isActive: !coupon.isActive }),
                              )
                            }
                          >
                            {coupon.isActive ? 'Tắt' : 'Bật'}
                          </button>
                          <button
                            type="button"
                            className="link-button link-button--danger"
                            onClick={() => {
                              if (!window.confirm('Xóa mã này? Mã sẽ được giải phóng để dùng lại.'))
                                return;
                              void run(() => deleteAdminCoupon(coupon.id));
                            }}
                          >
                            Xóa
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {coupons.data && coupons.data.meta.totalPages > 1 ? (
            <Pagination meta={coupons.data.meta} onPageChange={setPage} />
          ) : null}
        </>
      )}

      {historyFor ? (
        <section className="admin-panel" aria-labelledby="redemption-history-heading">
          <div className="admin-page__header">
            <h2 id="redemption-history-heading">Lượt dùng mã {historyFor.code}</h2>
            <button
              type="button"
              className="link-button"
              onClick={() => setHistoryFor(null)}
            >
              Đóng
            </button>
          </div>
          {redemptions.status === 'loading' ? (
            <StateBlock title="Đang tải lượt dùng…" />
          ) : redemptions.status === 'error' ? (
            <StateBlock
              title="Không tải được lượt dùng"
              description={redemptions.error?.message}
              actionLabel="Thử lại"
              onAction={redemptions.reload}
            />
          ) : (redemptions.data?.items.length ?? 0) === 0 ? (
            <p className="muted">Chưa có lượt dùng nào.</p>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Đơn hàng</th>
                    <th>Số tiền giảm</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.data!.items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.orderNo}</td>
                      <td>{formatVnd(row.discountAmount)}</td>
                      <td>
                        {row.status === 'applied' ? (
                          <span className="status status--delivered">Đã áp dụng</span>
                        ) : (
                          <span className="status status--cancelled">Đã giải phóng</span>
                        )}
                      </td>
                      <td className="muted">
                        {formatDateTime(row.createdAt)}
                        {row.releasedAt ? ` → ${formatDateTime(row.releasedAt)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {redemptions.data && redemptions.data.meta.totalPages > 1 ? (
                <Pagination meta={redemptions.data.meta} onPageChange={setHistoryPage} />
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
