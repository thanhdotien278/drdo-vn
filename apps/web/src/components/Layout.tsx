import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import type { AuthUser } from '../types/auth';
import { ACCOUNT_NAV_ITEMS, type AccountNavIcon } from './accountNav';

function LeafMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21c6-3.5 8-8.5 7.5-15.5C13 5.5 8 7.5 5.5 12.5c-1.6 3.3-.3 6.7 2.5 8 .9.4 2.7.6 4 .5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 21c0-6 2.5-10 7-14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Logo() {
  return (
    <Link className="logo" to="/" aria-label="DRDO — trang chủ">
      <LeafMark className="logo__leaf" />
      <span className="logo__word">DRDO</span>
      <span className="logo__tag">Pure skin · Brighter tomorrow</span>
    </Link>
  );
}

function SearchForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) {
      params.set('q', keyword.trim());
    }
    navigate({ pathname: '/products', search: params.toString() });
  }

  return (
    <form className="search-form" role="search" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor="site-search">
        Tìm kiếm sản phẩm
      </label>
      <svg className="search-form__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        id="site-search"
        type="search"
        placeholder="Tìm toner, serum, kem dưỡng…"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
    </form>
  );
}

function CartLink() {
  const { user, status } = useAuth();
  const { itemCount } = useCart();

  if (status === 'loading' || (user && !user.roles.includes('customer'))) {
    return null;
  }

  return (
    <Link
      className="cart-link"
      to="/cart"
      aria-label={itemCount > 0 ? `Giỏ hàng, ${itemCount} sản phẩm` : 'Giỏ hàng'}
    >
      <svg className="cart-link__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 5h1.8l2.3 10.4a1.6 1.6 0 0 0 1.6 1.3h6.7a1.6 1.6 0 0 0 1.6-1.3L19.5 8H7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10.4" cy="20" r="1.4" fill="currentColor" />
        <circle cx="16.9" cy="20" r="1.4" fill="currentColor" />
      </svg>
      {itemCount > 0 ? <span className="cart-link__count">{itemCount}</span> : null}
    </Link>
  );
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = userInitials(name);

  return (
    <span className="user-menu__avatar" aria-hidden="true">
      {avatarUrl && failedUrl !== avatarUrl ? (
        <img src={avatarUrl} alt="" onError={() => setFailedUrl(avatarUrl)} />
      ) : initials ? (
        initials
      ) : (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5.5 19.5c1-3.2 3.4-4.8 6.5-4.8s5.5 1.6 6.5 4.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

function UserMenu({ user }: { user: AuthUser }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const items: { to: string; label: string; Icon?: AccountNavIcon }[] = [];
  if (user.roles.includes('customer')) {
    items.push(...ACCOUNT_NAV_ITEMS);
  }
  if (user.roles.includes('employee')) {
    items.push(
      { to: '/employee/orders', label: 'Quản lý đơn' },
      { to: '/employee/reviews', label: 'Kiểm duyệt' },
    );
  }
  if (user.roles.includes('admin')) {
    items.push({ to: '/admin', label: 'Quản trị' });
  }

  function openMenu(focusFirstItem = false) {
    setOpen(true);
    if (focusFirstItem) {
      requestAnimationFrame(() => {
        rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
      });
    }
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(true);
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const menuItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const index = menuItems.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? (index + 1) % menuItems.length
        : (index - 1 + menuItems.length) % menuItems.length;
    menuItems[next]?.focus();
  }

  function handleLogout() {
    setOpen(false);
    void logout().then(() => navigate('/'));
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu-dropdown"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} />
        <span className="user-menu__name">{user.fullName}</span>
        <svg className="user-menu__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m6.5 9.5 5.5 5.5 5.5-5.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div
          className="user-menu__dropdown"
          id="user-menu-dropdown"
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => (
            <Link
              key={item.to}
              role="menuitem"
              className="user-menu__item"
              to={item.to}
              onClick={() => setOpen(false)}
            >
              {item.Icon ? <item.Icon /> : null}
              {item.label}
            </Link>
          ))}
          <hr className="user-menu__divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="user-menu__item user-menu__item--danger"
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AuthActions() {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return null;
  }

  if (!user) {
    return (
      <Link className="site-header__auth-link" to="/login">
        Đăng nhập
      </Link>
    );
  }

  return <UserMenu user={user} />;
}

export function Layout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Bỏ qua tới nội dung chính
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Logo />
          <nav className="site-nav" aria-label="Điều hướng chính">
            <NavLink to="/" end>
              Trang chủ
            </NavLink>
            <NavLink to="/products">Sản phẩm</NavLink>
            <Link to="/#ingredients">Thành phần thiên nhiên</Link>
            <Link to="/#commitment">Về DRDO</Link>
          </nav>
          <div className="site-header__actions">
            <SearchForm />
            <CartLink />
            <AuthActions />
            <Link className="button button--primary site-header__cta" to="/products">
              Mua ngay
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            <Logo />
            <p className="site-footer__tagline">
              Làn da khỏe đẹp hơn.
              <br />
              Một thế giới xanh hơn.
            </p>
          </div>
          <nav className="site-footer__col" aria-label="Về DRDO">
            <p className="site-footer__heading">Về DRDO</p>
            <Link to="/">Giới thiệu</Link>
            <Link to="/#commitment">Giá trị cốt lõi</Link>
            <Link to="/#ingredients">Thành phần thiên nhiên</Link>
            <Link to="/products">Tin tức</Link>
          </nav>
          <nav className="site-footer__col" aria-label="Hỗ trợ khách hàng">
            <p className="site-footer__heading">Hỗ trợ khách hàng</p>
            <Link to="/products">Hướng dẫn mua hàng</Link>
            <Link to="/products">Chính sách đổi trả</Link>
            <Link to="/products">Câu hỏi thường gặp</Link>
            <Link to="/products">Liên hệ</Link>
          </nav>
          <div className="site-footer__col">
            <p className="site-footer__heading">Kết nối với chúng tôi</p>
            <p className="site-footer__contact">Hotline: 1900 1234</p>
            <p className="site-footer__contact">cskh@drdo.vn</p>
            <div className="site-footer__social" aria-label="Mạng xã hội">
              <span className="social-dot" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5H17V5c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4V11H8v3h2.6v7h2.9Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="social-dot" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="17" cy="7" r="1.1" fill="currentColor" />
                </svg>
              </span>
              <span className="social-dot" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6.5c-.6.3-1.3.5-2 .6.7-.5 1.3-1.2 1.5-2-.7.4-1.5.7-2.3.9a3.6 3.6 0 0 0-6.2 3.3A10.3 10.3 0 0 1 4 6.1a3.6 3.6 0 0 0 1.1 4.8c-.6 0-1.1-.2-1.6-.4v.1c0 1.7 1.2 3.2 3 3.5-.6.2-1.2.2-1.8.1a3.6 3.6 0 0 0 3.4 2.5A7.3 7.3 0 0 1 3 18.2a10.3 10.3 0 0 0 15.7-8.6v-.5c.7-.5 1.2-1.2 1.3-2Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>
          <div className="site-footer__col site-footer__newsletter">
            <p className="site-footer__heading">Đăng ký nhận tin</p>
            <p className="site-footer__contact">Nhận thông tin ưu đãi và bí quyết chăm sóc da từ DRDO.</p>
            <form
              className="newsletter-form"
              onSubmit={(event) => event.preventDefault()}
            >
              <label className="visually-hidden" htmlFor="newsletter-email">
                Địa chỉ email
              </label>
              <input id="newsletter-email" type="email" placeholder="Nhập email của bạn" />
              <button type="submit" className="button button--primary">
                Đăng ký
              </button>
            </form>
          </div>
        </div>
        <div className="container site-footer__bottom">
          <p>© 2024 DRDO. Tất cả quyền được bảo lưu.</p>
          <div className="site-footer__legal">
            <Link to="/">Điều khoản sử dụng</Link>
            <Link to="/">Chính sách bảo mật</Link>
            <Link to="/">Sitemap</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
