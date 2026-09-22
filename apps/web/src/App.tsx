import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireAuth';
import { AddressesPage } from './pages/AddressesPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { EmployeeOrderDetailPage } from './pages/EmployeeOrderDetailPage';
import { EmployeeOrdersPage } from './pages/EmployeeOrdersPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductListPage } from './pages/ProductListPage';
import { RegisterPage } from './pages/RegisterPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route
          path="cart"
          element={
            <RequireRole roles={['customer']}>
              <CartPage />
            </RequireRole>
          }
        />
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
              <PlaceholderPage title="Yêu thích" />
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
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
