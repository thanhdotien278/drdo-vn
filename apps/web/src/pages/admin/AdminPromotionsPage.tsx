import { useState, type FormEvent } from 'react';
import { fetchAdminBrands, fetchAdminCategories } from '../../api/admin';
import { ApiRequestError } from '../../api/client';
import {
  createAdminPromotion,
  deleteAdminPromotion,
  fetchAdminPromotions,
  updateAdminPromotion,
  type AdminStatusFilter,
} from '../../api/promotions';
import { Pagination } from '../../components/Pagination';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminBrand, AdminCategory } from '../../types/admin';
import type { PageMeta } from '../../types/catalog';
import type { AdminPromotion } from '../../types/promotion';
import { formatVnd } from '../../utils/format';

const STATUS_OPTIONS: Array<{ value: AdminStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang bật' },
  { value: 'inactive', label: 'Đang tắt' },
  { value: 'deleted', label: 'Đã xóa' },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

function describeDiscount(promotion: AdminPromotion): string {
  const base =
    promotion.discountType === 'percentage'
      ? `${promotion.discountValue}%`
      : formatVnd(promotion.discountValue);
  return promotion.maxDiscountAmount != null
    ? `${base} (tối đa ${formatVnd(promotion.maxDiscountAmount)})`
    : base;
}

function describeScope(promotion: AdminPromotion): string {
  const parts: string[] = [];
  if (promotion.productIds.length > 0) parts.push(`${promotion.productIds.length} sản phẩm`);
  if (promotion.categoryIds.length > 0) parts.push(`${promotion.categoryIds.length} danh mục`);
  if (promotion.brandIds.length > 0) parts.push(`${promotion.brandIds.length} thương hiệu`);
  return parts.length > 0 ? parts.join(', ') : 'Toàn shop';
}

interface PromotionFormState {
  name: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: string;
  maxDiscountAmount: string;
  minOrderTotal: string;
  startAt: string;
  endAt: string;
  tierCodes: string;
  productIds: string;
  categoryIds: string[];
  brandIds: string[];
  isActive: boolean;
}

const EMPTY_FORM: PromotionFormState = {
  name: '',
  discountType: 'percentage',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderTotal: '0',
  startAt: '',
  endAt: '',
  tierCodes: '',
  productIds: '',
  categoryIds: [],
  brandIds: [],
  isActive: true,
};

function fromPromotion(promotion: AdminPromotion): PromotionFormState {
  return {
    name: promotion.name,
    discountType: promotion.discountType,
    discountValue: String(promotion.discountValue),
    maxDiscountAmount:
      promotion.maxDiscountAmount != null ? String(promotion.maxDiscountAmount) : '',
    minOrderTotal: String(promotion.minOrderTotal),
    startAt: toLocalInput(promotion.startAt),
    endAt: toLocalInput(promotion.endAt),
    tierCodes: promotion.tierCodes.join(', '),
    productIds: promotion.productIds.join(', '),
    categoryIds: promotion.categoryIds,
    brandIds: promotion.brandIds,
    isActive: promotion.isActive,
  };
}

const splitIds = (raw: string): string[] =>
  raw
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const selectedValues = (select: HTMLSelectElement): string[] =>
  Array.from(select.selectedOptions).map((option) => option.value);

/** Epic 9 — promotion management: create/edit/toggle/delete the rules behind coupons. */
export function AdminPromotionsPage() {
  const [status, setStatus] = useState<AdminStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPromotion | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PromotionFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const promotions = useAsync<{ items: AdminPromotion[]; meta: PageMeta }>(
    () => fetchAdminPromotions({ status, page }),
    [status, page],
  );
  const categories = useAsync<AdminCategory[]>(
    async () => (await fetchAdminCategories()).data,
    [],
  );
  const brands = useAsync<AdminBrand[]>(async () => (await fetchAdminBrands()).data, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(promotion: AdminPromotion) {
    setEditing(promotion);
    setForm(fromPromotion(promotion));
    setFormOpen(true);
  }

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      promotions.reload();
    } catch (error) {
      setActionError(error instanceof ApiRequestError ? error.message : 'Thao tác thất bại');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const fields = {
      name: form.name.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      maxDiscountAmount:
        form.maxDiscountAmount.trim() === '' ? null : Number(form.maxDiscountAmount),
      minOrderTotal: Number(form.minOrderTotal) || 0,
      startAt: toIso(form.startAt),
      endAt: toIso(form.endAt),
      tierCodes: splitIds(form.tierCodes).map((code) => code.toUpperCase()),
      productIds: splitIds(form.productIds),
      categoryIds: form.categoryIds,
      brandIds: form.brandIds,
      isActive: form.isActive,
    };
    const action = editing
      ? updateAdminPromotion(editing.id, fields)
      : createAdminPromotion(fields);
    action
      .then(() => {
        setFormOpen(false);
        setEditing(null);
        promotions.reload();
      })
      .catch((error: unknown) => {
        setActionError(
          error instanceof ApiRequestError ? error.message : 'Lưu chương trình thất bại',
        );
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="page admin-page">
      <div className="admin-page__header">
        <h1>Chương trình khuyến mãi</h1>
        <button type="button" className="button button--primary" onClick={openCreate}>
          Thêm chương trình
        </button>
      </div>

      <div className="staff-toolbar">
        <div className="form-field">
          <label htmlFor="promo-status-filter">Trạng thái</label>
          <select
            id="promo-status-filter"
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
          <h2>{editing ? 'Sửa chương trình' : 'Thêm chương trình'}</h2>
          <div className="form-grid">
            <div className="form-field form-field--wide">
              <label htmlFor="promo-name">Tên chương trình</label>
              <input
                id="promo-name"
                required
                maxLength={200}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-type">Loại giảm giá</label>
              <select
                id="promo-type"
                value={form.discountType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    discountType: event.target.value as PromotionFormState['discountType'],
                  })
                }
              >
                <option value="percentage">Phần trăm (%)</option>
                <option value="fixed_amount">Số tiền cố định (đ)</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="promo-value">
                Giá trị {form.discountType === 'percentage' ? '(%)' : '(đ)'}
              </label>
              <input
                id="promo-value"
                type="number"
                required
                min={0}
                value={form.discountValue}
                onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-max">Giảm tối đa (đ, để trống = không giới hạn)</label>
              <input
                id="promo-max"
                type="number"
                min={0}
                value={form.maxDiscountAmount}
                onChange={(event) => setForm({ ...form, maxDiscountAmount: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-min-order">Đơn tối thiểu (đ)</label>
              <input
                id="promo-min-order"
                type="number"
                min={0}
                value={form.minOrderTotal}
                onChange={(event) => setForm({ ...form, minOrderTotal: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-start">Bắt đầu</label>
              <input
                id="promo-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => setForm({ ...form, startAt: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-end">Kết thúc</label>
              <input
                id="promo-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => setForm({ ...form, endAt: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-tiers">Hạng áp dụng (trống = tất cả)</label>
              <input
                id="promo-tiers"
                value={form.tierCodes}
                placeholder="GOLD, PLATINUM"
                onChange={(event) => setForm({ ...form, tierCodes: event.target.value })}
              />
            </div>
            <div className="form-field form-field--wide">
              <label htmlFor="promo-products">ID sản phẩm áp dụng (phân tách bằng dấu phẩy)</label>
              <input
                id="promo-products"
                value={form.productIds}
                onChange={(event) => setForm({ ...form, productIds: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="promo-categories">Danh mục áp dụng</label>
              <select
                id="promo-categories"
                multiple
                size={Math.min(6, Math.max(2, categories.data?.length ?? 2))}
                value={form.categoryIds}
                onChange={(event) =>
                  setForm({ ...form, categoryIds: selectedValues(event.target) })
                }
              >
                {(categories.data ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="promo-brands">Thương hiệu áp dụng</label>
              <select
                id="promo-brands"
                multiple
                size={Math.min(6, Math.max(2, brands.data?.length ?? 2))}
                value={form.brandIds}
                onChange={(event) => setForm({ ...form, brandIds: selectedValues(event.target) })}
              >
                {(brands.data ?? []).map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="checkbox" htmlFor="promo-active">
                <input
                  id="promo-active"
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
              {submitting ? 'Đang lưu…' : 'Lưu chương trình'}
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

      {promotions.status === 'loading' ? (
        <StateBlock title="Đang tải chương trình…" />
      ) : promotions.status === 'error' ? (
        <StateBlock
          title="Không tải được chương trình"
          description={promotions.error?.message}
          actionLabel="Thử lại"
          onAction={promotions.reload}
        />
      ) : (promotions.data?.items.length ?? 0) === 0 ? (
        <StateBlock
          title="Chưa có chương trình"
          description="Tạo chương trình khuyến mãi rồi gắn mã giảm giá vào."
        />
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Giảm giá</th>
                <th>Phạm vi</th>
                <th>Đơn tối thiểu</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {promotions.data!.items.map((promotion) => (
                <tr key={promotion.id}>
                  <td>{promotion.name}</td>
                  <td>{describeDiscount(promotion)}</td>
                  <td className="muted">{describeScope(promotion)}</td>
                  <td>{promotion.minOrderTotal > 0 ? formatVnd(promotion.minOrderTotal) : '—'}</td>
                  <td className="muted">
                    {promotion.startAt
                      ? new Date(promotion.startAt).toLocaleDateString('vi-VN')
                      : '—'}
                    {' → '}
                    {promotion.endAt
                      ? new Date(promotion.endAt).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>
                  <td>
                    {promotion.isDeleted ? (
                      <span className="status status--cancelled">Đã xóa</span>
                    ) : promotion.isActive ? (
                      <span className="status status--delivered">Đang bật</span>
                    ) : (
                      <span className="status status--pending">Đang tắt</span>
                    )}
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      {!promotion.isDeleted ? (
                        <>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => openEdit(promotion)}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() =>
                              void run(() =>
                                updateAdminPromotion(promotion.id, {
                                  isActive: !promotion.isActive,
                                }),
                              )
                            }
                          >
                            {promotion.isActive ? 'Tắt' : 'Bật'}
                          </button>
                          <button
                            type="button"
                            className="link-button link-button--danger"
                            onClick={() => {
                              if (!window.confirm('Xóa chương trình này?')) return;
                              void run(() => deleteAdminPromotion(promotion.id));
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
          {promotions.data && promotions.data.meta.totalPages > 1 ? (
            <Pagination meta={promotions.data.meta} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
