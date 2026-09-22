import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';

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
    navigate({ pathname: '/san-pham', search: params.toString() });
  }

  return (
    <form className="search-form" role="search" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor="site-search">
        Tìm kiếm sản phẩm
      </label>
      <input
        id="site-search"
        type="search"
        placeholder="Tìm sữa rửa mặt, serum, chống nắng..."
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <button type="submit" className="button button--primary">
        Tìm
      </button>
    </form>
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
          <Link className="logo" to="/">
            DrDo<span>.vn</span>
          </Link>
          <nav className="site-nav" aria-label="Điều hướng chính">
            <NavLink to="/" end>
              Trang chủ
            </NavLink>
            <NavLink to="/san-pham">Sản phẩm</NavLink>
          </nav>
          <SearchForm />
        </div>
      </header>

      <main id="main-content" className="container site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div>
            <p className="logo logo--footer">DrDo.vn</p>
            <p>Sản phẩm chăm sóc da chính hãng, tư vấn theo từng loại da.</p>
          </div>
          <div>
            <p className="site-footer__heading">Hỗ trợ</p>
            <p>Hotline: 1900 1234</p>
            <p>Email: cskh@drdo.vn</p>
          </div>
          <div>
            <p className="site-footer__heading">Chính sách</p>
            <p>Giao hàng toàn quốc</p>
            <p>Đổi trả trong 7 ngày</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
