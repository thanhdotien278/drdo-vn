import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';

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
    <Link className="site-header__auth-link cart-link" to="/cart">
      Giỏ hàng
      {itemCount > 0 ? <span className="cart-link__count">{itemCount}</span> : null}
    </Link>
  );
}

function AuthActions() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="site-header__user">
      {user.roles.includes('customer') ? (
        <>
          <Link className="site-header__auth-link" to="/orders">
            Đơn hàng
          </Link>
          <Link className="site-header__auth-link" to="/wishlist">
            Yêu thích
          </Link>
          <Link className="site-header__auth-link" to="/addresses">
            Địa chỉ
          </Link>
          <Link className="site-header__auth-link" to="/loyalty">
            Điểm thưởng
          </Link>
        </>
      ) : null}
      {user.roles.includes('employee') ? (
        <>
          <Link className="site-header__auth-link" to="/employee/orders">
            Quản lý đơn
          </Link>
          <Link className="site-header__auth-link" to="/employee/reviews">
            Kiểm duyệt
          </Link>
        </>
      ) : null}
      {user.roles.includes('admin') ? (
        <Link className="site-header__auth-link" to="/admin">
          Quản trị
        </Link>
      ) : null}
      <Link className="site-header__auth-link" to="/account" title={user.email}>
        {user.fullName}
      </Link>
      <button
        type="button"
        className="link-button"
        onClick={() => {
          void logout().then(() => navigate('/'));
        }}
      >
        Đăng xuất
      </button>
    </div>
  );
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
