import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ACCOUNT_NAV_ITEMS, LogoutIcon } from './accountNav';
import { PageContainer } from './PageContainer';

/** Shared customer-account navigation — sidebar on desktop, scrollable row on mobile. */
export function AccountSidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    void logout().then(() => navigate('/'));
  }

  return (
    <nav className="account-nav" aria-label="Tài khoản">
      {ACCOUNT_NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className="account-nav__link">
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
      <hr className="account-nav__divider" role="separator" />
      <button
        type="button"
        className="account-nav__link account-nav__link--danger"
        onClick={handleLogout}
      >
        <LogoutIcon />
        <span>Đăng xuất</span>
      </button>
    </nav>
  );
}

export function AccountContent({ children }: { children: ReactNode }) {
  return <div className="account-content">{children}</div>;
}

export function AccountLayout() {
  return (
    <PageContainer className="page account-layout">
      <AccountSidebar />
      <AccountContent>
        <Outlet />
      </AccountContent>
    </PageContainer>
  );
}
