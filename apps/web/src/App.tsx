import { Route, Routes } from 'react-router-dom';
import { AccountLayout } from './components/AccountLayout';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireAuth';
import { AccountPage } from './pages/AccountPage';
import { AddressesPage } from './pages/AddressesPage';
import { AdminCustomerDetailPage } from './pages/admin/AdminCustomerDetailPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoyaltyTiersPage } from './pages/admin/AdminLoyaltyTiersPage';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminBannersPage } from './pages/admin/AdminBannersPage';
import { AdminCouponsPage } from './pages/admin/AdminCouponsPage';
import { AdminProductFormPage } from './pages/admin/AdminProductFormPage';
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { AdminStaffPage } from './pages/admin/AdminStaffPage';
import { AdminTaxonomyPage } from './pages/admin/AdminTaxonomyPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { EmployeeOrderDetailPage } from './pages/EmployeeOrderDetailPage';
import { EmployeeOrdersPage } from './pages/EmployeeOrdersPage';
import { EmployeeReviewsPage } from './pages/EmployeeReviewsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { LoyaltyPage } from './pages/LoyaltyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductListPage } from './pages/ProductListPage';
import { RegisterPage } from './pages/RegisterPage';
import { WishlistPage } from './pages/WishlistPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route
          path="checkout"
          element={
            <RequireRole roles={['customer']}>
              <CheckoutPage />
            </RequireRole>
          }
        />
        <Route
          element={
            <RequireRole roles={['customer']}>
              <AccountLayout />
            </RequireRole>
          }
        >
          <Route path="account" element={<AccountPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderNo" element={<OrderDetailPage />} />
          <Route path="addresses" element={<AddressesPage />} />
          <Route path="loyalty" element={<LoyaltyPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
        </Route>
        <Route
          path="employee/reviews"
          element={
            <RequireRole roles={['employee']}>
              <EmployeeReviewsPage />
            </RequireRole>
          }
        />
        <Route
          path="employee/orders"
          element={
            <RequireRole roles={['employee']}>
              <EmployeeOrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="employee/orders/:orderNo"
          element={
            <RequireRole roles={['employee']}>
              <EmployeeOrderDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="admin"
          element={
            <RequireRole roles={['admin']}>
              <AdminLayout />
            </RequireRole>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<AdminProductFormPage />} />
          <Route path="products/:id/edit" element={<AdminProductFormPage />} />
          <Route path="categories" element={<AdminTaxonomyPage kind="category" />} />
          <Route path="brands" element={<AdminTaxonomyPage kind="brand" />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:orderNo" element={<AdminOrderDetailPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="banners" element={<AdminBannersPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="customers/:id" element={<AdminCustomerDetailPage />} />
          <Route path="loyalty" element={<AdminLoyaltyTiersPage />} />
          <Route path="promotions" element={<AdminPromotionsPage />} />
          <Route path="coupons" element={<AdminCouponsPage />} />
          <Route path="staff" element={<AdminStaffPage />} />
        </Route>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
