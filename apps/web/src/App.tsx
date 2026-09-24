import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireAuth';
import { AddressesPage } from './pages/AddressesPage';
import { AdminCustomerDetailPage } from './pages/admin/AdminCustomerDetailPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoyaltyTiersPage } from './pages/admin/AdminLoyaltyTiersPage';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminBannersPage } from './pages/admin/AdminBannersPage';
import { AdminProductFormPage } from './pages/admin/AdminProductFormPage';
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
import { PlaceholderPage } from './pages/PlaceholderPage';
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
          path="orders"
          element={
            <RequireRole roles={['customer']}>
              <OrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="orders/:orderNo"
          element={
            <RequireRole roles={['customer']}>
              <OrderDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="addresses"
          element={
            <RequireRole roles={['customer']}>
              <AddressesPage />
            </RequireRole>
          }
        />
        <Route
          path="loyalty"
          element={
            <RequireRole roles={['customer']}>
              <LoyaltyPage />
            </RequireRole>
          }
        />
        <Route
          path="account"
          element={
            <RequireRole roles={['customer']}>
              <PlaceholderPage title="Tài khoản" />
            </RequireRole>
          }
        />
        <Route
          path="wishlist"
          element={
            <RequireRole roles={['customer']}>
              <WishlistPage />
            </RequireRole>
          }
        />
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
          <Route path="staff" element={<AdminStaffPage />} />
        </Route>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
