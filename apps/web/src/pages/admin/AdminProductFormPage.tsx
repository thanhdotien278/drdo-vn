import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createAdminProduct,
  deleteAdminProductImage,
  fetchAdminProduct,
  replaceAdminProductImage,
  updateAdminProduct,
  uploadAdminProductImages,
  type AdminProductInput,
} from '../../api/admin';
import { fetchBrands, fetchCategories } from '../../api/catalog';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminProduct } from '../../types/admin';
import type { Brand, Category } from '../../types/catalog';
import { formatVnd } from '../../utils/format';

interface FormState {
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  benefits: string;
  usageInstructions: string;
  volume: string;
  skinTypes: string;
  price: string;
  salePrice: string;
  stockOnHand: string;
  lowStockThreshold: string;
  category: string;
  brand: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  sku: '',
  shortDescription: '',
  description: '',
  ingredients: '',
  benefits: '',
  usageInstructions: '',
  volume: '',
  skinTypes: '',
  price: '',
  salePrice: '',
  stockOnHand: '0',
  lowStockThreshold: '5',
  category: '',
  brand: '',
  isActive: true,
};

function toFormState(product: AdminProduct): FormState {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription,
    description: product.description,
    ingredients: product.ingredients,
    benefits: product.benefits.join(', '),
    usageInstructions: product.usageInstructions,
    volume: product.volume,
    skinTypes: product.skinTypes.join(', '),
    price: String(product.price),
    salePrice: product.salePrice !== null ? String(product.salePrice) : '',
    stockOnHand: String(product.stockOnHand),
    lowStockThreshold: String(product.lowStockThreshold),
    category: product.category?.id ?? '',
    brand: product.brand?.id ?? '',
    isActive: product.isActive,
  };
}

function csvList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function imageFileName(url: string): string {
  return url.split('/').pop() ?? '';
}

function ProductImages({ product, onChanged }: { product: AdminProduct; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const replaceInput = useRef<HTMLInputElement | null>(null);
  const replaceTarget = useRef<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Thao tác ảnh thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="checkout-panel" aria-labelledby="images-heading">
      <h2 id="images-heading">Ảnh sản phẩm ({product.images.length}/6)</h2>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="admin-images">
        {product.images.map((image) => (
          <figure key={image.url} className="admin-image">
            <img src={image.url} alt={image.alt} />
            <figcaption className="muted">{image.isPrimary ? 'Ảnh chính' : 'Ảnh phụ'}</figcaption>
            <div className="admin-image__actions">
              <button
                type="button"
                className="link-button"
                disabled={busy}
                onClick={() => {
                  replaceTarget.current = imageFileName(image.url);
                  replaceInput.current?.click();
                }}
              >
                Thay thế
              </button>
              <button
                type="button"
                className="link-button link-button--danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm('Xóa ảnh này?')) return;
                  void run(() => deleteAdminProductImage(product.id, imageFileName(image.url)));
                }}
              >
                Xóa
              </button>
            </div>
          </figure>
        ))}
      </div>

      <input
        ref={replaceInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          const target = replaceTarget.current;
          event.target.value = '';
          if (!file || !target) return;
          void run(() => replaceAdminProductImage(product.id, target, file));
        }}
      />

      <div className="form-field">
        <label htmlFor="product-images-upload">Thêm ảnh (tối đa 6 ảnh, mỗi ảnh ≤ 5MB)</label>
        <input
          id="product-images-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={busy || product.images.length >= 6}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length === 0) return;
            void run(() => uploadAdminProductImages(product.id, files));
          }}
        />
      </div>
    </section>
  );
}

export function AdminProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refs = useAsync<{ categories: Category[]; brands: Brand[] }>(async () => {
    const [categories, brands] = await Promise.all([fetchCategories(), fetchBrands()]);
    return { categories: categories.data, brands: brands.data };
  }, []);

  const product = useAsync<AdminProduct | null>(
    async () => (id ? (await fetchAdminProduct(id)).data : null),
    [id],
  );

  useEffect(() => {
    if (product.data) {
      setForm(toFormState(product.data));
    }
  }, [product.data]);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload: AdminProductInput = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        shortDescription: form.shortDescription.trim(),
        description: form.description,
        ingredients: form.ingredients,
        benefits: csvList(form.benefits),
        usageInstructions: form.usageInstructions,
        volume: form.volume.trim(),
        skinTypes: csvList(form.skinTypes),
        price: Number(form.price),
        salePrice: form.salePrice.trim() === '' ? null : Number(form.salePrice),
        stockOnHand: Number(form.stockOnHand),
        lowStockThreshold: Number(form.lowStockThreshold),
        category: form.category,
        brand: form.brand,
        isActive: form.isActive,
      };
      if (form.slug.trim()) {
        payload.slug = form.slug.trim();
      }

      if (isEdit && id) {
        await updateAdminProduct(id, payload);
        product.reload();
      } else {
        const created = await createAdminProduct(payload);
        navigate(`/admin/products/${created.data.id}/edit`, { replace: true });
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Lưu sản phẩm thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && product.status === 'loading') {
    return (
      <div className="page">
        <StateBlock title="Đang tải sản phẩm…" />
      </div>
    );
  }

  if (isEdit && (product.status === 'error' || !product.data)) {
    return (
      <div className="page">
        <StateBlock
          title="Không tải được sản phẩm"
          description={product.error?.message}
          actionLabel="Thử lại"
          onAction={product.reload}
        />
      </div>
    );
  }

  const categories = refs.data?.categories ?? [];
  const brands = refs.data?.brands ?? [];

  return (
    <div className="page admin-page">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link to="/admin/products">Sản phẩm</Link>
        <span aria-hidden="true">/</span>
        <span>{isEdit ? form.name || 'Chỉnh sửa' : 'Thêm mới'}</span>
      </nav>

      <h1>{isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h1>

      <form className="admin-form" onSubmit={handleSubmit}>
        <section className="checkout-panel">
          <div className="form-grid">
            <div className="form-field form-field--wide">
              <label htmlFor="p-name">Tên sản phẩm *</label>
              <input
                id="p-name"
                value={form.name}
                required
                onChange={(event) => set('name', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-sku">SKU *</label>
              <input
                id="p-sku"
                value={form.sku}
                required
                onChange={(event) => set('sku', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-slug">Slug (để trống = tự tạo từ tên)</label>
              <input
                id="p-slug"
                value={form.slug}
                onChange={(event) => set('slug', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-price">Giá gốc (đ) *</label>
              <input
                id="p-price"
                type="number"
                min="0"
                value={form.price}
                required
                onChange={(event) => set('price', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-sale">Giá khuyến mãi (đ)</label>
              <input
                id="p-sale"
                type="number"
                min="0"
                value={form.salePrice}
                onChange={(event) => set('salePrice', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-stock">Tồn kho *</label>
              <input
                id="p-stock"
                type="number"
                min="0"
                step="1"
                value={form.stockOnHand}
                required
                onChange={(event) => set('stockOnHand', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-threshold">Ngưỡng cảnh báo tồn</label>
              <input
                id="p-threshold"
                type="number"
                min="0"
                step="1"
                value={form.lowStockThreshold}
                onChange={(event) => set('lowStockThreshold', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-category">Danh mục *</label>
              <select
                id="p-category"
                value={form.category}
                required
                onChange={(event) => set('category', event.target.value)}
              >
                <option value="">— Chọn danh mục —</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                {form.category &&
                product.data?.category &&
                !categories.some((category) => category.id === form.category) ? (
                  <option value={form.category}>{product.data.category.name} (ngừng dùng)</option>
                ) : null}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="p-brand">Thương hiệu *</label>
              <select
                id="p-brand"
                value={form.brand}
                required
                onChange={(event) => set('brand', event.target.value)}
              >
                <option value="">— Chọn thương hiệu —</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
                {form.brand &&
                product.data?.brand &&
                !brands.some((brand) => brand.id === form.brand) ? (
                  <option value={form.brand}>{product.data.brand.name} (ngừng dùng)</option>
                ) : null}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="p-volume">Dung tích / quy cách</label>
              <input
                id="p-volume"
                value={form.volume}
                onChange={(event) => set('volume', event.target.value)}
              />
            </div>
            <div className="form-field form-field--wide">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => set('isActive', event.target.checked)}
                />
                Đang bán trên storefront
              </label>
            </div>
            <div className="form-field form-field--wide">
              <label htmlFor="p-short">Mô tả ngắn</label>
              <input
                id="p-short"
                value={form.shortDescription}
                onChange={(event) => set('shortDescription', event.target.value)}
              />
            </div>
            <div className="form-field form-field--wide">
              <label htmlFor="p-desc">Mô tả chi tiết</label>
              <textarea
                id="p-desc"
                rows={4}
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
              />
            </div>
            <div className="form-field form-field--wide">
              <label htmlFor="p-ingredients">Thành phần</label>
              <textarea
                id="p-ingredients"
                rows={3}
                value={form.ingredients}
                onChange={(event) => set('ingredients', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-benefits">Công dụng (phân tách bằng dấu phẩy)</label>
              <input
                id="p-benefits"
                value={form.benefits}
                onChange={(event) => set('benefits', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="p-skin">Loại da phù hợp (phân tách bằng dấu phẩy)</label>
              <input
                id="p-skin"
                value={form.skinTypes}
                onChange={(event) => set('skinTypes', event.target.value)}
              />
            </div>
            <div className="form-field form-field--wide">
              <label htmlFor="p-usage">Hướng dẫn sử dụng</label>
              <textarea
                id="p-usage"
                rows={3}
                value={form.usageInstructions}
                onChange={(event) => set('usageInstructions', event.target.value)}
              />
            </div>
          </div>

          {formError ? (
            <p className="error-text" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="admin-form__actions">
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
            </button>
            <Link className="button button--outline" to="/admin/products">
              Quay lại
            </Link>
          </div>
        </section>
      </form>

      {isEdit && product.data ? (
        <>
          <ProductImages product={product.data} onChanged={product.reload} />
          <section className="checkout-panel">
            <h2>Thông tin thêm</h2>
            <p className="muted">
              Giá hiệu lực: {formatVnd(product.data.effectivePrice)} · Đã bán:{' '}
              {product.data.soldCount} · Đánh giá: {product.data.ratingAverage} (
              {product.data.ratingCount})
            </p>
          </section>
        </>
      ) : (
        <p className="muted">Lưu sản phẩm trước, sau đó bạn có thể tải ảnh lên (1–6 ảnh).</p>
      )}
    </div>
  );
}
