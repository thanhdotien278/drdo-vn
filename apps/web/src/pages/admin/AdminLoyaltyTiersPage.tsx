import { useState, type FormEvent } from 'react';
import { fetchAdminLoyaltyTiers, updateAdminLoyaltyTier } from '../../api/admin';
import { ApiRequestError } from '../../api/client';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { MembershipTier } from '../../types/loyalty';
import { formatVnd } from '../../utils/format';

interface TierFormState {
  name: string;
  minLifetimePoints: string;
  earnMultiplier: string;
  freeShippingThreshold: string;
  isActive: boolean;
}

function fromTier(tier: MembershipTier): TierFormState {
  return {
    name: tier.name,
    minLifetimePoints: String(tier.minLifetimePoints),
    earnMultiplier: String(tier.earnMultiplier),
    freeShippingThreshold:
      tier.freeShippingThreshold === null ? '' : String(tier.freeShippingThreshold),
    isActive: tier.isActive,
  };
}

function describeFreeShipping(tier: MembershipTier): string {
  if (tier.freeShippingThreshold === null) return 'Không';
  if (tier.freeShippingThreshold === 0) return 'Mọi đơn hàng';
  return `Đơn từ ${formatVnd(tier.freeShippingThreshold)}`;
}

/** Epic 8 — admin membership tier configuration (thresholds, multipliers, free shipping). */
export function AdminLoyaltyTiersPage() {
  const tiers = useAsync<MembershipTier[]>(
    async () => (await fetchAdminLoyaltyTiers()).data,
    [],
  );
  const [editing, setEditing] = useState<MembershipTier | null>(null);
  const [form, setForm] = useState<TierFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function openEdit(tier: MembershipTier) {
    setEditing(tier);
    setForm(fromTier(tier));
    setActionError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !form) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await updateAdminLoyaltyTier(editing.id, {
        name: form.name,
        minLifetimePoints: Number(form.minLifetimePoints),
        earnMultiplier: Number(form.earnMultiplier),
        freeShippingThreshold:
          form.freeShippingThreshold.trim() === '' ? null : Number(form.freeShippingThreshold),
        isActive: form.isActive,
      });
      setEditing(null);
      setForm(null);
      tiers.reload();
    } catch (error) {
      setActionError(error instanceof ApiRequestError ? error.message : 'Lưu hạng thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page admin-page">
      <div className="admin-page__header">
        <h1>Hạng thành viên</h1>
      </div>
      <p className="muted">
        Ngưỡng điểm tích lũy quyết định hạng; hạng chỉ tăng, không giảm. Phí ship miễn phí tính trên
        tạm tính sau giảm giá, trước khi trừ điểm.
      </p>

      {actionError ? (
        <p className="error-text" role="alert">
          {actionError}
        </p>
      ) : null}

      {editing && form ? (
        <form className="admin-panel" onSubmit={handleSubmit}>
          <h2>Sửa hạng {editing.code}</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="tier-name">Tên hiển thị</label>
              <input
                id="tier-name"
                value={form.name}
                maxLength={120}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="tier-floor">Điểm tích lũy tối thiểu</label>
              <input
                id="tier-floor"
                type="number"
                min={0}
                step={1}
                value={form.minLifetimePoints}
                onChange={(event) => setForm({ ...form, minLifetimePoints: event.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="tier-multiplier">Hệ số tích điểm</label>
              <input
                id="tier-multiplier"
                type="number"
                min={0}
                step={0.05}
                value={form.earnMultiplier}
                onChange={(event) => setForm({ ...form, earnMultiplier: event.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="tier-shipping">Ngưỡng freeship (để trống = không; 0 = mọi đơn)</label>
              <input
                id="tier-shipping"
                type="number"
                min={0}
                step={1000}
                value={form.freeShippingThreshold}
                onChange={(event) =>
                  setForm({ ...form, freeShippingThreshold: event.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label className="checkbox" htmlFor="tier-active">
                <input
                  id="tier-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Đang áp dụng
              </label>
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Đang lưu…' : 'Lưu hạng'}
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setEditing(null);
                setForm(null);
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      {tiers.status === 'loading' ? (
        <StateBlock title="Đang tải hạng thành viên…" />
      ) : tiers.status === 'error' ? (
        <StateBlock
          title="Không tải được hạng thành viên"
          description={tiers.error?.message}
          actionLabel="Thử lại"
          onAction={tiers.reload}
        />
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Điểm tối thiểu</th>
              <th>Hệ số</th>
              <th>Freeship</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(tiers.data ?? []).map((tier) => (
              <tr key={tier.id}>
                <td>
                  <strong>{tier.code}</strong>
                </td>
                <td>{tier.name}</td>
                <td>{tier.minLifetimePoints.toLocaleString('vi-VN')}</td>
                <td>×{tier.earnMultiplier}</td>
                <td>{describeFreeShipping(tier)}</td>
                <td>
                  {tier.isActive ? (
                    <span className="status status--delivered">Đang áp dụng</span>
                  ) : (
                    <span className="status status--pending">Đang tắt</span>
                  )}
                </td>
                <td>
                  <div className="admin-table__actions">
                    <button type="button" className="link-button" onClick={() => openEdit(tier)}>
                      Sửa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
