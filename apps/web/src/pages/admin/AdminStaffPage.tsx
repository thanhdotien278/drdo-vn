import { useState, type FormEvent } from 'react';
import {
  createAdminStaff,
  fetchAdminStaff,
  setAdminStaffRole,
  setAdminStaffStatus,
} from '../../api/admin';
import { ApiRequestError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StateBlock } from '../../components/StateBlock';
import { useAsync } from '../../hooks/useAsync';
import type { AdminStaff } from '../../types/admin';
import { formatDateTime } from '../../utils/labels';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị',
  employee: 'Nhân viên',
  customer: 'Khách hàng',
};

const STATUS_LABELS: Record<AdminStaff['status'], string> = {
  active: 'Hoạt động',
  blocked: 'Đã khóa',
  inactive: 'Ngừng hoạt động',
};

export function AdminStaffPage() {
  const { user: me } = useAuth();
  const staff = useAsync<AdminStaff[]>(async () => (await fetchAdminStaff()).data, []);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createAdminStaff({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role,
      });
      setEmail('');
      setFullName('');
      setPhone('');
      setPassword('');
      setRole('employee');
      staff.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tạo tài khoản thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      staff.reload();
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : 'Thao tác thất bại';
      setError(message);
    }
  }

  return (
    <div className="page admin-page">
      <h1>Nhân sự</h1>

      <section className="checkout-panel" aria-labelledby="staff-create-heading">
        <h2 id="staff-create-heading">Tạo tài khoản nhân sự</h2>
        <form className="admin-form" onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="s-name">Họ tên *</label>
              <input
                id="s-name"
                value={fullName}
                required
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="s-email">Email *</label>
              <input
                id="s-email"
                type="email"
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="s-phone">Số điện thoại</label>
              <input
                id="s-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="s-password">Mật khẩu (≥ 8 ký tự) *</label>
              <input
                id="s-password"
                type="password"
                value={password}
                required
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="s-role">Vai trò *</label>
              <select
                id="s-role"
                value={role}
                onChange={(event) => setRole(event.target.value as 'admin' | 'employee')}
              >
                <option value="employee">Nhân viên</option>
                <option value="admin">Quản trị</option>
              </select>
            </div>
          </div>
          <div className="admin-form__actions">
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? 'Đang tạo…' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {staff.status === 'loading' ? (
        <StateBlock title="Đang tải nhân sự…" />
      ) : staff.status === 'error' ? (
        <StateBlock
          title="Không tải được nhân sự"
          description={staff.error?.message}
          actionLabel="Thử lại"
          onAction={staff.reload}
        />
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Đăng nhập gần nhất</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {(staff.data ?? []).map((member) => {
              const isSelf = member.id === me?.id;
              return (
                <tr key={member.id}>
                  <td>
                    {member.fullName}
                    {isSelf ? ' (bạn)' : ''}
                  </td>
                  <td>{member.email}</td>
                  <td>
                    {isSelf ? (
                      ROLE_LABELS[member.roles[0]] ?? member.roles.join(', ')
                    ) : (
                      <select
                        aria-label={`Vai trò của ${member.fullName}`}
                        value={member.roles[0]}
                        onChange={(event) =>
                          void run(() =>
                            setAdminStaffRole(
                              member.id,
                              event.target.value as 'admin' | 'employee',
                            ),
                          )
                        }
                      >
                        <option value="employee">Nhân viên</option>
                        <option value="admin">Quản trị</option>
                      </select>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status ${member.status === 'active' ? 'status--delivered' : 'status--cancelled'}`}
                    >
                      {STATUS_LABELS[member.status]}
                    </span>
                  </td>
                  <td>{member.lastLoginAt ? formatDateTime(member.lastLoginAt) : '—'}</td>
                  <td>
                    {isSelf ? (
                      <span className="muted">Tài khoản của bạn</span>
                    ) : (
                      <button
                        type="button"
                        className={
                          member.status === 'active'
                            ? 'link-button link-button--danger'
                            : 'link-button'
                        }
                        onClick={() => {
                          const next = member.status === 'active' ? 'inactive' : 'active';
                          if (
                            next === 'inactive' &&
                            !window.confirm(`Vô hiệu hóa tài khoản "${member.fullName}"?`)
                          ) {
                            return;
                          }
                          void run(() => setAdminStaffStatus(member.id, next));
                        }}
                      >
                        {member.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
