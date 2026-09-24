import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  createAddress,
  fetchAddresses,
  updateAddress,
} from '../api/addresses';
import { changePassword } from '../api/auth';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AddressForm } from '../components/AddressForm';
import { useAsync } from '../hooks/useAsync';
import type { Address } from '../types/commerce';
import { isValidVnPhone } from '../utils/validation';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

function PersonalInfoSection() {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Re-sync when the auth user is refreshed from elsewhere — useState
  // initializers only run on mount.
  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.fullName, user?.phone]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length < 2) {
      setNotice({ kind: 'error', text: 'Vui lòng nhập họ tên' });
      return;
    }
    if (!isValidVnPhone(trimmedPhone)) {
      setNotice({ kind: 'error', text: 'Số điện thoại không hợp lệ' });
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ fullName: trimmedName, phone: trimmedPhone });
      setNotice({ kind: 'success', text: 'Đã lưu thông tin cá nhân.' });
    } catch (err) {
      setNotice({ kind: 'error', text: errorMessage(err, 'Không lưu được. Vui lòng thử lại.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="checkout-panel" aria-labelledby="profile-info-heading">
      <h2 id="profile-info-heading">Thông tin cá nhân</h2>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="profile-name">Họ tên</label>
          <input
            id="profile-name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            type="email"
            autoComplete="email"
            readOnly
            aria-readonly="true"
            value={user?.email ?? ''}
          />
          <p className="muted">Email dùng để đăng nhập và không thể thay đổi.</p>
        </div>
        <div className="form-field">
          <label htmlFor="profile-phone">Số điện thoại</label>
          <input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>

        <p
          role="status"
          className={notice ? (notice.kind === 'success' ? 'success-text' : 'error-text') : 'visually-hidden'}
        >
          {notice?.text ?? ''}
        </p>

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </section>
  );
}

function DefaultAddressSection() {
  const addresses = useAsync<Address[]>(async () => (await fetchAddresses()).data, []);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      await action();
      setEditing(false);
      setCreating(false);
      addresses.reload();
    } catch (err) {
      setError(errorMessage(err, 'Thao tác không thành công.'));
    } finally {
      setSubmitting(false);
    }
  }

  const list = addresses.data ?? [];
  const defaultAddress = list.find((address) => address.isDefault) ?? null;

  let body;
  if (addresses.status === 'loading') {
    body = <p className="muted">Đang tải địa chỉ…</p>;
  } else if (addresses.status === 'error') {
    body = (
      <>
        <p className="error-text" role="alert">
          Không tải được địa chỉ. {addresses.error?.message}
        </p>
        <button type="button" className="link-button" onClick={addresses.reload}>
          Thử lại
        </button>
      </>
    );
  } else if (creating) {
    body = (
      <AddressForm
        submitting={submitting}
        onSubmit={(values) => void run(() => createAddress({ ...values, isDefault: true }))}
        onCancel={() => setCreating(false)}
      />
    );
  } else if (defaultAddress && editing) {
    body = (
      <AddressForm
        initial={defaultAddress}
        submitting={submitting}
        onSubmit={(values) => void run(() => updateAddress(defaultAddress.id, values))}
        onCancel={() => setEditing(false)}
      />
    );
  } else if (defaultAddress) {
    body = (
      <>
        <div className="address-card__body">
          <p>
            <strong>{defaultAddress.fullName}</strong>
          </p>
          <p className="muted">{defaultAddress.phone}</p>
          <p className="muted">
            {defaultAddress.line1}
            {defaultAddress.line2 ? `, ${defaultAddress.line2}` : ''}, {defaultAddress.ward},{' '}
            {defaultAddress.district}, {defaultAddress.province}
          </p>
        </div>
        <div className="address-card__actions">
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Chỉnh sửa
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p className="muted">Chưa có địa chỉ giao hàng mặc định.</p>
        <div className="address-card__actions">
          <button type="button" className="link-button" onClick={() => setCreating(true)}>
            Thêm địa chỉ
          </button>
        </div>
      </>
    );
  }

  return (
    <section className="checkout-panel" aria-labelledby="profile-address-heading">
      <h2 id="profile-address-heading">Địa chỉ giao hàng mặc định</h2>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      {body}
      {!creating && !editing && list.length > 0 ? (
        <p className="profile-address__manage">
          <Link className="link-button" to="/addresses">
            Quản lý sổ địa chỉ
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (newPassword.length < 8) {
      setNotice({ kind: 'error', text: 'Mật khẩu phải có ít nhất 8 ký tự' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ kind: 'error', text: 'Mật khẩu nhập lại không khớp' });
      return;
    }

    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice({ kind: 'success', text: 'Đổi mật khẩu thành công.' });
    } catch (err) {
      // The API returns a generic 401 for a wrong current password — map it
      // back to a helpful message for the legitimate account owner.
      const text =
        err instanceof ApiRequestError && err.status === 401
          ? 'Mật khẩu hiện tại không đúng'
          : errorMessage(err, 'Không đổi được mật khẩu. Vui lòng thử lại.');
      setNotice({ kind: 'error', text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="checkout-panel" aria-labelledby="profile-security-heading">
      <h2 id="profile-security-heading">Bảo mật</h2>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="profile-current-password">Mật khẩu hiện tại</label>
          <input
            id="profile-current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="profile-new-password">Mật khẩu mới</label>
          <input
            id="profile-new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="profile-confirm-password">Nhập lại mật khẩu mới</label>
          <input
            id="profile-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        <p
          role="status"
          className={notice ? (notice.kind === 'success' ? 'success-text' : 'error-text') : 'visually-hidden'}
        >
          {notice?.text ?? ''}
        </p>

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? 'Đang đổi…' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function AccountPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <>
      <h1>Hồ sơ của tôi</h1>
      <div className="profile-sections">
        <PersonalInfoSection />
        <DefaultAddressSection />
        <SecuritySection />
      </div>
    </>
  );
}
