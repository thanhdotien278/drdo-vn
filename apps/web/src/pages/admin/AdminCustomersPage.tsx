import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminCustomers, setAdminCustomerStatus } from '../../api/admin';
import { Pagination } from '../../components/Pagination';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminCustomer } from '../../types/admin';
import type { PageMeta } from '../../types/catalog';
import { formatDateTime } from '../../utils/labels';

const STATUS_LABELS: Record<AdminCustomer['status'], string> = {
  active: 'Hoạt động',
  blocked: 'Đã khóa',
  inactive: 'Chưa kích hoạt',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'blocked', label: 'Đã khóa' },
  { value: 'inactive', label: 'Chưa kích hoạt' },
] as const;

export function AdminCustomersPage() {
  const [q, setQ] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'' | AdminCustomer['status']>('');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const customers = useAsync<{ items: AdminCustomer[]; meta: PageMeta }>(
    () => fetchAdminCustomers({ q: keyword, status, page }),
    [keyword, status, page],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKeyword(q.trim());
    setPage(1);
  }

  async function toggleBlock(customer: AdminCustomer) {
    const next = customer.status === 'blocked' ? 'active' : 'blocked';
    const question =
      next === 'blocked'
        ? `Khóa tài khoản "${customer.fullName}"? Khách sẽ không đăng nhập được nữa.`
        : `Mở khóa tài khoản "${customer.fullName}"?`;
    if (!window.confirm(question)) return;
    setActionError(null);
    try {
      await setAdminCustomerStatus(customer.id, next);
      customers.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Thao tác thất bại');
    }
  }

  return (
    <div className="page admin-page">
      <h1>Khách hàng</h1>

      <div className="staff-toolbar">
        <form className="search-form" role="search" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Tìm theo tên, email, SĐT…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            aria-label="Tìm khách hàng"
          />
        </form>
        <div className="form-field">
          <label htmlFor="customer-status-filter">Trạng thái</label>
          <select
            id="customer-status-filter"
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

      {customers.status === 'loading' ? (
        <StateBlock title="Đang tải khách hàng…" />
      ) : customers.status === 'error' ? (
        <StateBlock
          title="Không tải được khách hàng"
          description={customers.error?.message}
          actionLabel="Thử lại"
          onAction={customers.reload}
        />
      ) : (customers.data?.items.length ?? 0) === 0 ? (
        <StateBlock title="Không có khách hàng" description="Không tìm thấy khách hàng phù hợp." />
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Email</th>
                <th>SĐT</th>
                <th>Trạng thái</th>
                <th>Đăng ký</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {customers.data!.items.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link to={`/admin/customers/${customer.id}`}>{customer.fullName}</Link>
                  </td>
                  <td>{customer.email}</td>
                  <td>{customer.phone || '—'}</td>
                  <td>
                    <span
                      className={`status ${customer.status === 'blocked' ? 'status--cancelled' : 'status--delivered'}`}
                    >
                      {STATUS_LABELS[customer.status]}
                    </span>
                  </td>
                  <td>{formatDateTime(customer.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={
                        customer.status === 'blocked' ? 'link-button' : 'link-button link-button--danger'
                      }
                      onClick={() => void toggleBlock(customer)}
                    >
                      {customer.status === 'blocked' ? 'Mở khóa' : 'Khóa'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.data && customers.data.meta.totalPages > 1 ? (
            <Pagination meta={customers.data.meta} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
