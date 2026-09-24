import { useAuth } from '../auth/AuthContext';

export function AccountPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <>
      <h1>Hồ sơ của tôi</h1>
      <section className="checkout-panel" aria-label="Thông tin cá nhân">
        <dl className="summary-rows">
          <div className="summary-row">
            <dt>Họ tên</dt>
            <dd>{user.fullName}</dd>
          </div>
          <div className="summary-row">
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="summary-row">
            <dt>Số điện thoại</dt>
            <dd>{user.phone || '—'}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
