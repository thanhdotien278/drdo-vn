import { useState, type FormEvent } from 'react';
import { ApiRequestError } from '../../api/client';
import {
  createAdminBanner,
  deleteAdminBanner,
  fetchAdminBanners,
  updateAdminBanner,
  type BannerStatusFilter,
} from '../../api/banners';
import { Pagination } from '../../components/Pagination';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminBanner } from '../../types/engagement';
import type { PageMeta } from '../../types/catalog';

const STATUS_OPTIONS: Array<{ value: BannerStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hiển thị' },
  { value: 'inactive', label: 'Đang ẩn' },
  { value: 'deleted', label: 'Đã xóa' },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(local: string): string | undefined {
  return local ? new Date(local).toISOString() : undefined;
}

interface BannerFormState {
  title: string;
  subtitle: string;
  linkUrl: string;
  imageAlt: string;
  displayOrder: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

const EMPTY_FORM: BannerFormState = {
  title: '',
  subtitle: '',
  linkUrl: '',
  imageAlt: '',
  displayOrder: '0',
  startAt: '',
  endAt: '',
  isActive: true,
};

function fromBanner(banner: AdminBanner): BannerFormState {
  return {
    title: banner.title,
    subtitle: banner.subtitle,
    linkUrl: banner.linkUrl,
    imageAlt: banner.imageAlt,
    displayOrder: String(banner.displayOrder),
    startAt: toLocalInput(banner.startAt),
    endAt: toLocalInput(banner.endAt),
    isActive: banner.isActive,
  };
}

/** Story 7.5 — admin banner management: create/edit/reorder/activate/delete with image upload. */
export function AdminBannersPage() {
  const [status, setStatus] = useState<BannerStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const banners = useAsync<{ items: AdminBanner[]; meta: PageMeta }>(
    () => fetchAdminBanners({ status, page }),
    [status, page],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setImage(null);
    setFormOpen(true);
  }

  function openEdit(banner: AdminBanner) {
    setEditing(banner);
    setForm(fromBanner(banner));
    setImage(null);
    setFormOpen(true);
  }

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      banners.reload();
    } catch (error) {
      setActionError(error instanceof ApiRequestError ? error.message : 'Thao tác thất bại');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const fields = {
      title: form.title,
      subtitle: form.subtitle,
      linkUrl: form.linkUrl,
      imageAlt: form.imageAlt,
      displayOrder: Number(form.displayOrder) || 0,
      startAt: toIso(form.startAt),
      endAt: toIso(form.endAt),
      isActive: form.isActive,
    };
    const action = editing
      ? updateAdminBanner(editing.id, fields, image)
      : image
        ? createAdminBanner(fields, image)
        : Promise.reject(new ApiRequestError(400, 'Vui lòng chọn ảnh banner'));
    action
      .then(() => {
        setFormOpen(false);
        setEditing(null);
        banners.reload();
      })
      .catch((error: unknown) => {
        setActionError(error instanceof ApiRequestError ? error.message : 'Lưu banner thất bại');
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="page admin-page">
      <div className="admin-page__header">
        <h1>Banner trang chủ</h1>
        <button type="button" className="button button--primary" onClick={openCreate}>
          Thêm banner
        </button>
      </div>

      <div className="staff-toolbar">
        <div className="form-field">
          <label htmlFor="banner-status-filter">Trạng thái</label>
          <select
            id="banner-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as BannerStatusFilter);
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
        <form className="banner-form admin-panel" onSubmit={handleSubmit}>
          <h2>{editing ? 'Sửa banner' : 'Thêm banner'}</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="banner-title">Tiêu đề</label>
              <input
                id="banner-title"
                value={form.title}
                maxLength={200}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="banner-subtitle">Phụ đề</label>
              <input
                id="banner-subtitle"
                value={form.subtitle}
                maxLength={500}
                onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="banner-link">Liên kết (ví dụ /products)</label>
              <input
                id="banner-link"
                value={form.linkUrl}
                maxLength={500}
                onChange={(event) => setForm({ ...form, linkUrl: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="banner-alt">Mô tả ảnh</label>
              <input
                id="banner-alt"
                value={form.imageAlt}
                maxLength={200}
                onChange={(event) => setForm({ ...form, imageAlt: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="banner-order">Thứ tự hiển thị</label>
              <input
                id="banner-order"
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(event) => setForm({ ...form, displayOrder: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="banner-image">Ảnh banner {editing ? '(để trống nếu giữ ảnh cũ)' : ''}</label>
              <input
                id="banner-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="banner-start">Bắt đầu hiển thị</label>
              <input
                id="banner-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(event) => setForm({ ...form, startAt: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="banner-end">Kết thúc hiển thị</label>
              <input
                id="banner-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(event) => setForm({ ...form, endAt: event.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="checkbox" htmlFor="banner-active">
                <input
                  id="banner-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Hiển thị
              </label>
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Đang lưu…' : 'Lưu banner'}
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

      {banners.status === 'loading' ? (
        <StateBlock title="Đang tải banner…" />
      ) : banners.status === 'error' ? (
        <StateBlock
          title="Không tải được banner"
          description={banners.error?.message}
          actionLabel="Thử lại"
          onAction={banners.reload}
        />
      ) : (banners.data?.items.length ?? 0) === 0 ? (
        <StateBlock title="Chưa có banner" description="Tạo banner để hiển thị trên trang chủ." />
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Tiêu đề</th>
                <th>Thứ tự</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {banners.data!.items.map((banner) => (
                <tr key={banner.id}>
                  <td>
                    <img className="admin-table__thumb" src={banner.imageUrl} alt={banner.imageAlt || banner.title} />
                  </td>
                  <td>
                    {banner.title || '—'}
                    {banner.linkUrl ? (
                      <>
                        <br />
                        <span className="muted">{banner.linkUrl}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{banner.displayOrder}</td>
                  <td className="muted">
                    {banner.startAt ? new Date(banner.startAt).toLocaleDateString('vi-VN') : '—'}
                    {' → '}
                    {banner.endAt ? new Date(banner.endAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td>
                    {banner.isDeleted ? (
                      <span className="status status--cancelled">Đã xóa</span>
                    ) : banner.isActive ? (
                      <span className="status status--delivered">Đang hiển thị</span>
                    ) : (
                      <span className="status status--pending">Đang ẩn</span>
                    )}
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      {!banner.isDeleted ? (
                        <>
                          <button type="button" className="link-button" onClick={() => openEdit(banner)}>
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() =>
                              void run(() =>
                                updateAdminBanner(banner.id, { isActive: !banner.isActive }),
                              )
                            }
                          >
                            {banner.isActive ? 'Ẩn' : 'Hiển thị'}
                          </button>
                          <button
                            type="button"
                            className="link-button link-button--danger"
                            onClick={() => {
                              if (!window.confirm('Xóa banner này?')) return;
                              void run(() => deleteAdminBanner(banner.id));
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
          {banners.data && banners.data.meta.totalPages > 1 ? (
            <Pagination meta={banners.data.meta} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
