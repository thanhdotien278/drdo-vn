# DrDo.vn API Specification v1

This is the MVP API contract. Payment provider integration is Phase 2; promotion, coupon, loyalty, wishlist, review, and banner APIs are **Phase 1 / MVP** (PRD FR-07 to FR-09, superseding ADR-0004).

## Conventions

- Authenticated requests require a bearer token or session cookie.
- Anonymous protected requests return `401`.
- Authenticated users without permission return `403`.
- Manual payment status values: `unpaid`, `paid`.
- MVP payment methods: `cod`, `bank_transfer`, `momo_manual`.
- Revenue uses `paidAt` for orders where `paymentStatus=paid` and `orderStatus != cancelled`.
- Error bodies are always `{ error, code }`, with a SCREAMING_SNAKE `code`; some carry an extra `details` object.
- Collections return `{ data }`, or `{ data, pagination: { page, limit, total, totalPages } }` when paginated. Single resources return a named key (`{ product }`, `{ order }`, …). Deletes return `{ ok: true }`.
- **Roles are exact.** An admin does not implicitly hold the `employee` role: the same order-operations handlers are mounted twice, once under `/employee/orders` and once under `/admin/orders`, and each role uses its own prefix.
- Every order carries the fixed seven-field totals block (`subtotal`, `discountAmount`, `couponRef`, `pointsRedeemed`, `pointsDiscountAmount`, `shippingFee`, `grandTotal`), always present even when zero, always computed server-side.
- Uploaded images are served from `/uploads/**`; an `:imageId` path parameter **is the stored filename**.

## RBAC Matrix

| Route / Action | Public | Customer | Employee | Admin |
| --- | --- | --- | --- | --- |
| `POST /auth/register` | Yes | Yes | No | No |
| `POST /auth/login` | Yes | Yes | Yes | Yes |
| `GET /auth/me` | No | Own profile | Own profile | Own profile |
| `GET /products`, `GET /products/:slug`, `GET /categories`, `GET /brands` | Yes | Yes | Yes | Yes |
| `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id` | No | Own cart | No | No |
| `GET /addresses`, `POST /addresses`, `PATCH /addresses/:id`, `DELETE /addresses/:id`, `PATCH /addresses/:id/default` | No | Own addresses | No | No |
| `POST /orders`, `GET /orders`, `GET /orders/:orderNo` | No | Own orders only | No | No |
| `GET /employee/orders`, `GET /employee/orders/:orderNo` | No | No | Yes | No |
| `PATCH /employee/orders/:orderNo/status` | No | No | Yes | No |
| `PATCH /employee/orders/:orderNo/payment` | No | No | Yes | No |
| `GET /admin/dashboard` | No | No | No | Yes |
| `GET /admin/products`, `POST /admin/products`, `PATCH /admin/products/:id`, `DELETE /admin/products/:id` | No | No | No | Yes |
| `GET /admin/categories`, `POST /admin/categories`, `PATCH /admin/categories/:id`, `DELETE /admin/categories/:id` | No | No | No | Yes |
| `GET /admin/brands`, `POST /admin/brands`, `PATCH /admin/brands/:id`, `DELETE /admin/brands/:id` | No | No | No | Yes |
| `GET /admin/orders`, `GET /admin/orders/:orderNo` | No | No | No | Yes |
| `PATCH /admin/orders/:orderNo/status` | No | No | No | Yes |
| `PATCH /admin/orders/:orderNo/payment` | No | No | No | Yes |
| `GET /admin/customers`, `GET /admin/customers/:id`, `PATCH /admin/customers/:id/status` | No | No | No | Yes |
| `GET /admin/staff`, `POST /admin/staff`, `PATCH /admin/staff/:id/role`, `PATCH /admin/staff/:id/status` | No | No | No | Yes |
| `GET /admin/audit-logs` | No | No | No | Yes |
| `POST /orders/preview` | No | Own cart | No | No |
| `POST /coupons/validate` | No | Own cart | No | No |
| `GET /wishlist`, `POST /wishlist/items`, `DELETE /wishlist/items/:productId`, `POST /wishlist/items/:productId/move-to-cart` | No | Own wishlist | No | No |
| `GET /products/:slug/reviews` | Yes | Yes | Yes | Yes |
| `POST /products/:slug/reviews` | No | Purchasers only | No | No |
| `PATCH /reviews/:id`, `DELETE /reviews/:id`, `GET /reviews/me` | No | Own reviews | No | No |
| `GET /banners` | Yes | Yes | Yes | Yes |
| `GET /loyalty/me`, `GET /loyalty/me/ledger` | No | Own account | No | No |
| `GET /employee/reviews`, `PATCH /employee/reviews/:id/status`, `DELETE /employee/reviews/:id` | No | No | Yes | No |
| `GET /employee/coupons`, `GET /employee/coupons/:code` | No | No | Read-only | No |
| `GET /admin/reviews`, `PATCH /admin/reviews/:id/status`, `DELETE /admin/reviews/:id` | No | No | No | Yes |
| `POST /admin/products/:id/images`, `PATCH /admin/products/:id/images/:imageId`, `DELETE /admin/products/:id/images/:imageId` | No | No | No | Yes |
| `GET /admin/banners`, `POST /admin/banners`, `PATCH /admin/banners/:id`, `DELETE /admin/banners/:id`, `POST /admin/banners/:id/image`, `PATCH /admin/banners/reorder` | No | No | No | Yes |
| `GET /admin/promotions`, `POST /admin/promotions`, `PATCH /admin/promotions/:id`, `DELETE /admin/promotions/:id` | No | No | No | Yes |
| `GET /admin/coupons`, `POST /admin/coupons`, `PATCH /admin/coupons/:id`, `DELETE /admin/coupons/:id`, `GET /admin/coupons/:id/redemptions` | No | No | No | Yes |
| `GET /admin/membership-tiers`, `POST /admin/membership-tiers`, `PATCH /admin/membership-tiers/:id` | No | No | No | Yes |
| `GET /admin/customers/:id/loyalty`, `POST /admin/customers/:id/loyalty/adjustments` | No | No | No | Yes |
| `GET /uploads/**` | Yes | Yes | Yes | Yes |

Notes on this matrix:

- **Employees have no coupon or promotion write route at all.** FR-09.1 is enforced by the absence of those handlers, not by a permission flag, so there is no code path to misconfigure. FR-09.1a is satisfied by the read-only routes above plus the coupon snapshot already stored on each order.
- **Employees cannot adjust loyalty points** (FR-08.11) for the same reason: the adjustment route exists only under `/admin`.
- **Employees are excluded from the dashboard, catalog, customer, staff, and audit surfaces** (ADR-0010).
- `POST /orders/preview` exists because FR-09.7a forbids trusting client-computed totals: it is the only way the checkout screen can display a discount, the value of redeemed points, or the shipping fee before submitting. A rejected coupon is returned as `couponError` with HTTP 200 so the rest of the totals still render.

## Authentication

- `POST /auth/register` - Register a new customer.
- `POST /auth/login` - Login for customer, employee, and admin.
- `GET /auth/me` - Get current user profile.

## Catalog

- `GET /products` - List active products. Query: `page`, `limit`, `q`, `category`, `brand`, `minPrice`, `maxPrice`, `availability`, `sort`.
- `GET /products/:slug` - Get active product details by slug.
- `GET /categories` - List active categories.
- `GET /brands` - List active brands.

## Cart

- `GET /cart` - Get current customer's cart.
- `POST /cart/items` - Add or merge item into cart.
- `PATCH /cart/items/:id` - Update cart item quantity.
- `DELETE /cart/items/:id` - Remove cart item.

## Customer Addresses

- `GET /addresses` - List current customer's saved shipping addresses.
- `POST /addresses` - Create a saved shipping address without postal code.
- `PATCH /addresses/:id` - Update current customer's saved shipping address.
- `DELETE /addresses/:id` - Delete current customer's saved shipping address.
- `PATCH /addresses/:id/default` - Set current customer's default saved shipping address.

## Customer Orders

- `POST /orders` - Create order from current cart. New orders always use `paymentStatus=unpaid`.
- `GET /orders` - List current customer's orders newest first.
- `GET /orders/:orderNo` - Get current customer's order detail.

## Employee Orders

- `GET /employee/orders` - List all orders for fulfillment.
- `GET /employee/orders/:orderNo` - Get order detail for fulfillment.
- `PATCH /employee/orders/:orderNo/status` - Update order status using the shared state machine.
- `PATCH /employee/orders/:orderNo/payment` - Manually set payment status to `unpaid` or `paid`; `unpaid -> paid` sets `paidAt`, `paid -> unpaid` clears `paidAt`, and every change writes an audit log.

## Admin Dashboard

- `GET /admin/dashboard` - Get orders today/week, revenue today/week by `paidAt`, order counts by status, and low-stock products.
- `GET /admin/audit-logs` - List audit logs. Query: `page`, `limit`, `actorId`, `entityType`, `entityId`, `action`.

## Admin Catalog

- `GET /admin/products` - List products including inactive/soft-deleted records.
- `POST /admin/products` - Create product.
- `POST /admin/products/:id/images` - Upload product images to `/uploads/products` until the product has 1-6 images; stores URL/path metadata.
- `PATCH /admin/products/:id/images/:imageId` - Replace one product image file and update its URL/path metadata.
- `DELETE /admin/products/:id/images/:imageId` - Delete one product image file and remove its URL/path metadata.
- `PATCH /admin/products/:id` - Update product.
- `DELETE /admin/products/:id` - Soft delete product.
- `GET /admin/categories` - List categories.
- `POST /admin/categories` - Create category.
- `PATCH /admin/categories/:id` - Update category.
- `DELETE /admin/categories/:id` - Soft delete category; blocked when products reference it.
- `GET /admin/brands` - List brands.
- `POST /admin/brands` - Create brand.
- `PATCH /admin/brands/:id` - Update brand.
- `DELETE /admin/brands/:id` - Soft delete brand; blocked when products reference it.

## Admin Orders And Payments

- `GET /admin/orders` - List all orders.
- `GET /admin/orders/:orderNo` - Get any order detail.
- `PATCH /admin/orders/:orderNo/status` - Update order status using the shared state machine.
- `PATCH /admin/orders/:orderNo/payment` - Manually set payment status to `unpaid` or `paid`; `unpaid -> paid` sets `paidAt`, `paid -> unpaid` clears `paidAt`, and every change writes an audit log.

## Admin Customers And Staff

- `GET /admin/customers` - List customers. Query: `page`, `limit`, `q`, `status`.
- `GET /admin/customers/:id` - Get customer profile and order summary.
- `PATCH /admin/customers/:id/status` - Block or unblock customer.
- `GET /admin/staff` - List admin and employee users.
- `POST /admin/staff` - Create staff member.
- `PATCH /admin/staff/:id/role` - Set staff role to `admin` or `employee`.
- `PATCH /admin/staff/:id/status` - Activate or deactivate staff; self-deactivation is rejected.
