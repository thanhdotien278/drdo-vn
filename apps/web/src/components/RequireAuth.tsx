import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../types/auth';
import { StateBlock } from './StateBlock';

function LoadingState() {
  return <StateBlock title="Đang tải…" description="Đang kiểm tra phiên đăng nhập." />;
}

/**
 * UX guards only — the backend enforces RBAC; these keep anonymous visitors
 * out of protected screens (redirect to login) and show a forbidden state
 * when the signed-in account lacks the required role.
 */
export function RequireAuth({ children }: { children: ReactElement }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingState />;
  }
  if (!user) {
    const from = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?from=${from}`} replace />;
  }
  return children;
}

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactElement }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingState />;
  }
  if (!user) {
    const from = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?from=${from}`} replace />;
  }
  if (!roles.some((role) => user.roles.includes(role))) {
    return (
      <StateBlock
        title="Không có quyền truy cập"
        description="Tài khoản của bạn không được phép sử dụng tính năng này."
      />
    );
  }
  return children;
}
