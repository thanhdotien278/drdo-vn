import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteAdminProduct,
  fetchAdminProducts,
  updateAdminProduct,
  type AdminProductQuery,
} from '../../api/admin';
import { Pagination } from '../../components/Pagination';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminProduct } from '../../types/admin';
import type { PageMeta } from '../../types/catalog';
import { formatVnd } from '../../utils/format';

const STATUS_OPTIONS: Array<{ value: NonNullable<AdminProductQuery['status']>; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang bán' },
  { value: 'inactive', label: 'Ngừng bán' },
  { value: 'deleted', label: 'Đã xóa' },
];

export function AdminProductsPage() {
  const [q, setQ] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<NonNullable<AdminProductQuery['status']>>('all');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const products = useAsync<{ items: AdminProduct[]; meta: PageMeta }>(
    () => fetchAdminProducts({ q: keyword, status, page }),
    [keyword, status, page],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKeyword(q.trim());
    setPage(1);
  }

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      products.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Thao tác thất bại');
    }
  }

  return (
    <div className="page admin-page">
      <div className="admin-page__header">
        <h1>Sản phẩm</h1>
        <Link className="button button--primary" to="/admin/products/new">
          Thêm sản phẩm
        </Link>
      </div>

      <div className="staff-toolbar">
        <form className="search-form" role="search" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Tìm theo tên, SKU…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            aria-label="Tìm sản phẩm"
          />
        </form>
        <div className="form-field">
          <label htmlFor="product-status-filter">Trạng thái</label>
          <select
            id="product-status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status);
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

      {products.status === 'loading' ? (
        <StateBlock title="Đang tải sản phẩm…" />
      ) : products.status === 'error' ? (
        <StateBlock
          title="Không tải được sản phẩm"
          description={products.error?.message}
          actionLabel="Thử lại"
          onAction={products.reload}
        />
      ) : (products.data?.items.length ?? 0) === 0 ? (
        <StateBlock title="Không có sản phẩm" description="Chưa có sản phẩm phù hợp bộ lọc." />
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>SKU</th>
                <th>Giá</th>
                <th>Tồn kho</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {products.data!.items.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link to={`/admin/products/${product.id}/edit`}>{product.name}</Link>
                  </td>
                  <td>{product.sku}</td>
                  <td>{formatVnd(product.effectivePrice)}</td>
                  <td>{product.availableStock}</td>
                  <td>
                    {product.isDeleted ? (
                      <span className="status status--cancelled">Đã xóa</span>
                    ) : product.isActive ? (
                      <span className="status status--delivered">Đang bán</span>
                    ) : (
                      <span className="status status--pending">Ngừng bán</span>
                    )}
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      {!product.isDeleted ? (
                        <>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() =>
                              void run(() =>
                                updateAdminProduct(product.id, { isActive: !product.isActive }),
                              )
                            }
                          >
                            {product.isActive ? 'Ngừng bán' : 'Bán lại'}
                          </button>
                          <button
                            type="button"
                            className="link-button link-button--danger"
                            onClick={() => {
                              if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) return;
                              void run(() => deleteAdminProduct(product.id));
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
          {products.data && products.data.meta.totalPages > 1 ? (
            <Pagination meta={products.data.meta} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
