import { useState, type FormEvent } from 'react';
import {
  createAdminBrand,
  createAdminCategory,
  deleteAdminBrand,
  deleteAdminCategory,
  fetchAdminBrands,
  fetchAdminCategories,
  updateAdminBrand,
  updateAdminCategory,
  type AdminTaxonomyInput,
} from '../../api/admin';
import { ApiRequestError } from '../../api/client';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminBrand, AdminCategory } from '../../types/admin';

type TaxonomyKind = 'category' | 'brand';

type TaxonomyItem = AdminCategory | AdminBrand;

const CONFIG: Record<
  TaxonomyKind,
  {
    title: string;
    extraFields: Array<{ key: 'imageUrl' | 'logoUrl' | 'country'; label: string }>;
    fetchAll: () => Promise<{ data: TaxonomyItem[] }>;
    create: (input: AdminTaxonomyInput) => Promise<unknown>;
    update: (id: string, input: Partial<AdminTaxonomyInput>) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
    inUseCode: string;
  }
> = {
  category: {
    title: 'Danh mục',
    extraFields: [{ key: 'imageUrl', label: 'Ảnh danh mục (URL)' }],
    fetchAll: fetchAdminCategories,
    create: createAdminCategory,
    update: updateAdminCategory,
    remove: deleteAdminCategory,
    inUseCode: 'CATEGORY_IN_USE',
  },
  brand: {
    title: 'Thương hiệu',
    extraFields: [
      { key: 'logoUrl', label: 'Logo (URL)' },
      { key: 'country', label: 'Quốc gia' },
    ],
    fetchAll: fetchAdminBrands,
    create: createAdminBrand,
    update: updateAdminBrand,
    remove: deleteAdminBrand,
    inUseCode: 'BRAND_IN_USE',
  },
};

interface TaxonomyForm {
  name: string;
  slug: string;
  description: string;
  displayOrder: string;
  isActive: boolean;
  imageUrl: string;
  logoUrl: string;
  country: string;
}

const EMPTY_FORM: TaxonomyForm = {
  name: '',
  slug: '',
  description: '',
  displayOrder: '0',
  isActive: true,
  imageUrl: '',
  logoUrl: '',
  country: '',
};

function toForm(item: TaxonomyItem): TaxonomyForm {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description,
    displayOrder: String(item.displayOrder ?? 0),
    isActive: item.isActive,
    imageUrl: 'imageUrl' in item ? item.imageUrl : '',
    logoUrl: 'logoUrl' in item ? item.logoUrl : '',
    country: 'country' in item ? item.country : '',
  };
}

export function AdminTaxonomyPage({ kind }: { kind: TaxonomyKind }) {
  const config = CONFIG[kind];
  const items = useAsync<TaxonomyItem[]>(async () => (await config.fetchAll()).data, [kind]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaxonomyForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof TaxonomyForm>(field: K, value: TaxonomyForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: AdminTaxonomyInput = {
        name: form.name.trim(),
        description: form.description,
        displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive,
      };
      if (form.slug.trim()) payload.slug = form.slug.trim();
      if (kind === 'category') payload.imageUrl = form.imageUrl.trim();
      if (kind === 'brand') {
        payload.logoUrl = form.logoUrl.trim();
        payload.country = form.country.trim();
      }
      if (editingId) {
        await config.update(editingId, payload);
      } else {
        await config.create(payload);
      }
      resetForm();
      items.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: TaxonomyItem) {
    if (!window.confirm(`Xóa ${config.title.toLowerCase()} "${item.name}"?`)) return;
    setError(null);
    try {
      await config.remove(item.id);
      items.reload();
    } catch (caught) {
      const inUse = caught instanceof ApiRequestError && caught.code === config.inUseCode;
      setError(
        inUse
          ? `${item.name} đang được sản phẩm sử dụng — hãy chuyển sản phẩm sang ${config.title.toLowerCase()} khác trước.`
          : caught instanceof Error
            ? caught.message
            : 'Xóa thất bại',
      );
    }
  }

  return (
    <div className="page admin-page">
      <h1>{config.title}</h1>

      <section className="checkout-panel">
        <h2>{editingId ? 'Chỉnh sửa' : 'Thêm mới'}</h2>
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="t-name">Tên *</label>
              <input
                id="t-name"
                value={form.name}
                required
                onChange={(event) => set('name', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="t-slug">Slug (để trống = tự tạo)</label>
              <input
                id="t-slug"
                value={form.slug}
                onChange={(event) => set('slug', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="t-order">Thứ tự hiển thị</label>
              <input
                id="t-order"
                type="number"
                min="0"
                step="1"
                value={form.displayOrder}
                onChange={(event) => set('displayOrder', event.target.value)}
              />
            </div>
            {config.extraFields.map((field) => (
              <div className="form-field" key={field.key}>
                <label htmlFor={`t-${field.key}`}>{field.label}</label>
                <input
                  id={`t-${field.key}`}
                  value={form[field.key]}
                  onChange={(event) => set(field.key, event.target.value)}
                />
              </div>
            ))}
            <div className="form-field form-field--wide">
              <label htmlFor="t-desc">Mô tả</label>
              <input
                id="t-desc"
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
              />
            </div>
            <div className="form-field form-field--wide">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => set('isActive', event.target.checked)}
                />
                Hiển thị trên storefront
              </label>
            </div>
          </div>
          {error ? (
            <p className="error-text" role="alert">
              {error}
            </p>
          ) : null}
          <div className="admin-form__actions">
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Thêm mới'}
            </button>
            {editingId ? (
              <button type="button" className="button button--outline" onClick={resetForm}>
                Hủy chỉnh sửa
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {items.status === 'loading' ? (
        <StateBlock title={`Đang tải ${config.title.toLowerCase()}…`} />
      ) : items.status === 'error' ? (
        <StateBlock
          title="Không tải được dữ liệu"
          description={items.error?.message}
          actionLabel="Thử lại"
          onAction={items.reload}
        />
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Slug</th>
              <th>Thứ tự</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(items.data ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.slug}</td>
                <td>{item.displayOrder}</td>
                <td>
                  {item.isDeleted ? (
                    <span className="status status--cancelled">Đã xóa</span>
                  ) : item.isActive ? (
                    <span className="status status--delivered">Hiển thị</span>
                  ) : (
                    <span className="status status--pending">Ẩn</span>
                  )}
                </td>
                <td>
                  <div className="admin-table__actions">
                    {!item.isDeleted ? (
                      <>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            setEditingId(item.id);
                            setForm(toForm(item));
                            setError(null);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="link-button link-button--danger"
                          onClick={() => void handleDelete(item)}
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
      )}
    </div>
  );
}
