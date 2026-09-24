import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/admin', label: 'Tổng quan', end: true },
  { to: '/admin/products', label: 'Sản phẩm' },
  { to: '/admin/categories', label: 'Danh mục' },
  { to: '/admin/brands', label: 'Thương hiệu' },
  { to: '/admin/orders', label: 'Đơn hàng' },
  { to: '/admin/customers', label: 'Khách hàng' },
  { to: '/admin/loyalty', label: 'Hạng thành viên' },
  { to: '/admin/promotions', label: 'Khuyến mãi' },
  { to: '/admin/coupons', label: 'Mã giảm giá' },
  { to: '/admin/reviews', label: 'Đánh giá' },
  { to: '/admin/banners', label: 'Banner' },
  { to: '/admin/staff', label: 'Nhân sự' },
];

/** Epic 5 — admin shell. Backend RBAC is the security boundary; this is navigation only. */
export function AdminLayout() {
  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Quản trị">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="admin-nav__link">
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
