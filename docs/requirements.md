# DrDo.vn Requirements

## 1. Product Summary

DrDo.vn is a Vietnamese beauty and skincare e-commerce website. The rebuild should keep the useful product scope from DrDo2, but start clean: simple architecture, clear role boundaries, and no dependency on old implementation details.

Primary goal: let customers discover skincare products, buy them through a cart and checkout flow, and let staff/admins operate catalog, orders, inventory, customers, and manual payment status.

Target market: Vietnamese skincare and beauty buyers, especially users shopping on mobile.

## 2. Source Assumptions

- Existing docs describe the desired product, not a strict implementation contract.
- `api-spec.md` and `erd.md` are useful references for API/data shape.
- Sprint docs separate MVP operations from later advanced features. Use MVP first.
- Payment integration is Phase 2: checkout creates unpaid orders, and MVP payment status changes are manual only.
- Old repo paths, scripts, and tooling notes are reference only. Do not copy old code structure blindly.

## 3. Users And Roles

### Customer

Customers can browse products, manage cart, checkout, track orders, and manage supported profile data.

### Employee

Employees operate daily order workflows. They can view orders, view customer/shipping information needed for fulfillment, update order status, and handle inventory-related order effects. They should not manage product catalog, users, promotions, or reports unless later expanded.

### Admin

Admins manage the business. They have full MVP access to catalog, orders, customers, staff, manual payment status, dashboard metrics, and audit logs.

## 4. MVP Scope

Build these first:

- Public storefront: home, product listing, search/filter/sort, product detail.
- Authentication: register, login, current profile, logout.
- Customer commerce: persistent cart, checkout, order creation, order history/detail.
- Customer address book: customers can manage their own saved shipping addresses and use them at checkout.
- Manual payment state: `cod`, `bank_transfer`, and `momo_manual` selectable as payment method labels; every new order starts as `paymentStatus=unpaid`.
- Product images: local server uploads under `/uploads/products`, with URL/path metadata stored on products.
- Employee dashboard: order list/detail and valid status transitions.
- Admin dashboard: core metrics, product/category/brand management, customer view/blocking, staff management, order/payment management.
- RBAC enforced on backend APIs.
- Audit log for operational changes.
- Seed/demo data for Vietnamese skincare products, roles, and orders.

## 5. Out Of Scope For MVP

- Native mobile app.
- Marketplace with third-party sellers.
- Product variants/SKU matrix.
- Complex warehouse/multi-location inventory.
- Full accounting integration.
- Advanced analytics, export scheduling, saved filters, and bulk admin workflows.
- 2FA, unless admin security becomes a launch requirement.
- Real MoMo gateway, bank gateway, IPN/callback, and automatic payment verification.
- Returns, refunds, and reversal after shipment.

## 6. Functional Requirements

### FR-01 Authentication And Session

- FR-01.1 Customers can register with required identity fields.
- FR-01.2 All roles can log in using a secure credential flow.
- FR-01.3 Authenticated users can fetch their current profile from `GET /auth/me`.
- FR-01.4 Blocked users cannot log in or use protected APIs.
- FR-01.5 Protected pages redirect anonymous users to login.
- FR-01.6 Protected APIs return `401` for unauthenticated users.

### FR-02 Role-Based Access Control

- FR-02.1 Backend authorization is the source of truth.
- FR-02.2 Customers cannot access employee or admin APIs.
- FR-02.3 Employees can access order operations only.
- FR-02.4 Admins can access all management APIs.
- FR-02.5 Unauthorized role access returns `403`.
- FR-02.6 Frontend role checks are for UX only, not security.

### FR-03 Product Catalog

- FR-03.1 Customers can list products with pagination.
- FR-03.2 Customers can search products by keyword.
- FR-03.3 Customers can filter by category, brand, price range, and availability.
- FR-03.4 Customers can sort by newest, price ascending, price descending, and popularity.
- FR-03.5 Product detail pages show images, name, price, sale price, brand, category, stock state, description, ingredients, benefits, and usage instructions when present.
- FR-03.6 Inactive products should not appear in normal storefront browsing.
- FR-03.7 Out-of-stock products must clearly prevent checkout.

### FR-04 Category And Brand

- FR-04.1 Customers can browse categories and brands.
- FR-04.2 Admins can create, edit, activate/deactivate, and soft delete categories.
- FR-04.3 Admins can create, edit, activate/deactivate, and soft delete brands.
- FR-04.4 Deleting categories or brands with assigned products is blocked unless products are reassigned.

### FR-05 Cart

- FR-05.1 Authenticated customers have a persistent cart.
- FR-05.2 Customers can add products to cart.
- FR-05.3 Adding the same product updates quantity instead of duplicating rows.
- FR-05.4 Customers can update quantity and remove items.
- FR-05.5 Cart totals recalculate after every change.
- FR-05.6 Cart uses a price snapshot when creating orders.
- FR-05.7 Cart rejects inactive products and quantities above available stock.

### FR-06 Checkout And Orders

- FR-06.1 Customers can create an order from a valid cart.
- FR-06.2 Checkout requires shipping/contact information.
- FR-06.3 Checkout can copy shipping/contact fields from a saved address or from inline checkout input.
- FR-06.4 Orders store an immutable shipping/contact snapshot.
- FR-06.5 New orders start with `orderStatus=pending`.
- FR-06.6 New orders start with `paymentStatus=unpaid`.
- FR-06.7 Cart is cleared after successful order creation.
- FR-06.8 Customers can view only their own order list and order details.
- FR-06.9 Customers cannot mutate order status or payment status.
- FR-06.10 Order items keep snapshots of product name, SKU, unit price, quantity, and line total.

### FR-07 Order Status Workflow

- FR-07.1 Supported order statuses: `pending`, `processing`, `shipped`, `delivered`, `cancelled`.
- FR-07.2 Valid forward transitions:
  - `pending -> processing`
  - `processing -> shipped`
  - `shipped -> delivered`
- FR-07.3 `pending` and `processing` orders can be cancelled.
- FR-07.4 Delivered and cancelled orders are final.
- FR-07.5 Backward transitions are rejected.
- FR-07.6 Every status change records actor, previous status, next status, reason if supplied, and timestamp.

### FR-08 Inventory

- FR-08.1 Checkout reserves stock.
- FR-08.2 Shipping deducts stock on hand.
- FR-08.3 Cancelling before shipment releases reserved stock.
- FR-08.4 Cancelling after shipment is blocked in MVP.
- FR-08.5 Low-stock products are visible to admin.
- FR-08.6 Inventory updates must be deterministic and auditable.

### FR-09 Customer Account

- FR-09.1 Customers can view and edit supported profile fields.
- FR-09.2 Customers can list, create, edit, delete, and set a default saved shipping address.
- FR-09.3 Customers can view order history newest first.
- FR-09.4 Customers can view order detail with timeline, items, totals, payment method, and payment status.
- FR-09.5 Customers can manage only their own saved addresses.
- FR-09.6 Saved addresses and order shipping snapshots do not include postal code in MVP.

### FR-10 Employee Dashboard

- FR-10.1 Employees can view order list.
- FR-10.2 Employees can filter orders by status.
- FR-10.3 Employees can view order detail and fulfillment information.
- FR-10.4 Employees can update order status using the valid workflow.
- FR-10.5 Employees cannot manage product catalog, staff, reports, promotions, or site settings in MVP.

### FR-11 Admin Dashboard

- FR-11.1 Admin dashboard shows total orders today/this week.
- FR-11.2 Admin dashboard shows revenue today/this week.
- FR-11.3 Admin dashboard shows orders grouped by status.
- FR-11.4 Admin dashboard shows low-stock products.
- FR-11.5 MVP dashboard should stay operational and simple; advanced charts are Phase 2.
- FR-11.6 MVP revenue is the sum of `grandTotal` for orders where `paymentStatus=paid` and `orderStatus != cancelled`.
- FR-11.7 MVP revenue is counted by `paidAt`, not order creation date.

### FR-12 Admin Catalog Management

- FR-12.1 Admins can create products.
- FR-12.2 Admins can edit product details, prices, stock, images, category, brand, and active status.
- FR-12.3 Admins can soft delete products.
- FR-12.4 Product validation rejects missing required fields and invalid numeric values.
- FR-12.5 Product changes appear in storefront browsing.
- FR-12.6 MVP product images are uploaded to local server storage under `/uploads/products`.
- FR-12.7 Product records store only image URL/path metadata.
- FR-12.8 Products support 1-6 images.
- FR-12.9 Admins can upload, replace, and delete product images.
- FR-12.10 Public storefront reads product image URLs normally from product data.
- FR-12.11 Image storage stays behind a small service interface so Phase 2 can move to S3, Cloudinary, or MinIO without rewriting product logic.
- FR-12.12 S3, Cloudinary, MinIO, CDN, image transformation pipeline, and complex media manager are excluded from MVP.

### FR-13 Admin Order And Payment Management

- FR-13.1 Admins can view all orders.
- FR-13.2 Admins can view any order detail.
- FR-13.3 Admins can update order status using the same status rules as employees.
- FR-13.4 Admins can manually mark payment as `paid` or `unpaid`.
- FR-13.5 Employees can manually mark payment as `paid` or `unpaid` through employee order operations.
- FR-13.6 Customers cannot update payment status.
- FR-13.7 Checkout itself must not mark an order paid.
- FR-13.8 Every manual payment status change creates an audit log.
- FR-13.9 Changing payment status from `unpaid` to `paid` sets `paidAt`.
- FR-13.10 Correcting payment status from `paid` to `unpaid` clears `paidAt` and records the correction in the audit log.

### FR-14 Admin Customer Management

- FR-14.1 Admins can view customer list.
- FR-14.2 Admins can search customers by name, email, or phone.
- FR-14.3 Admins can view customer profile and order history.
- FR-14.4 Admins can block or unblock customer accounts.

### FR-15 Staff Management

- FR-15.1 Admins can view staff list.
- FR-15.2 Admins can create staff accounts.
- FR-15.3 Admins can assign admin or employee role.
- FR-15.4 Admins can activate/deactivate staff accounts.
- FR-15.5 Admins cannot deactivate their own active account.
- FR-15.6 All staff role/status changes are audited.

### FR-16 Promotions And Coupons

Promotions and coupons are **Phase 1 / MVP** (supersedes ADR-0004). See `_bmad-output/prd.md` FR-09 for the authoritative text.

- FR-16.1 Only Admins may create, edit, enable/disable, or delete promotions and coupons. Employees have read-only visibility in order context so they can explain a discount on an order they are processing.
- FR-16.2 A promotion defines a discount type (percentage or fixed), a value, and an optional maximum cap.
- FR-16.3 A promotion defines eligibility: active date range, minimum order total, applicable products/categories/brands, and applicable membership tiers. The product/category/brand scope defines the **discount base**, not merely eligibility.
- FR-16.4 A coupon defines a unique case-insensitive code, a total usage limit, and a per-customer usage limit.
- FR-16.5 One coupon per order; stacking is not supported.
- FR-16.6 Checkout validates server-side and rejects unknown, inactive, expired, over-limit, or ineligible codes with a distinct error code per reason.
- FR-16.7 Every order records the fixed seven-field totals block (`subtotal`, `discountAmount`, `couponRef`, `pointsRedeemed`, `pointsDiscountAmount`, `shippingFee`, `grandTotal`), computed server-side, stored even when zero, with `grandTotal` clamped at 0.
- FR-16.8 Applying a coupon records a redemption tied to the order and customer; cancelling the order releases it against usage limits.
- FR-16.9 Discount and coupon fields are an immutable snapshot on the order; later promotion edits never change historical orders. Coupon deletion is a soft delete.

### FR-18 Wishlist, Reviews, And Banners

Wishlist, moderated product reviews, and storefront banners are **Phase 1 / MVP**. See `_bmad-output/prd.md` FR-07.

- FR-18.1 Authenticated customers have one persistent wishlist; entries show current price, sale price, and stock state and can be moved into the cart.
- FR-18.2 Inactive or deleted products are hidden from wishlist browsing without breaking the list.
- FR-18.3 Only a customer who has bought a product may review it, once, with a 1-5 star rating and optional text.
- FR-18.4 Reviews are moderated: a new review starts `pending` and is public only after admin or employee approval. Editing an approved review returns it to `pending`.
- FR-18.5 Product list and detail expose average rating and review count derived from approved reviews only.
- FR-18.6 Admins manage banners (create, edit, reorder, activate/deactivate, soft delete); banner images follow the product-image storage rules.
- FR-18.7 The storefront renders only active banners whose date range covers the current time, in display order.

### FR-19 Loyalty And Memberships

Loyalty and memberships are **Phase 1 / MVP**. See `_bmad-output/prd.md` FR-08.

- FR-19.1 Points accrue at 1 point per 1,000đ of goods paid for, awarded when an order reaches `shipped` — never at `paid` — at most once per order.
- FR-19.2 Points redeem at 10đ each, in multiples of 100, bounded by balance and capped at 20% of the cart subtotal.
- FR-19.3 Balances and lifetime totals are derived from an append-only ledger; there is no mutable point counter.
- FR-19.4 Four membership tiers (Đồng, Bạc, Vàng, Bạch Kim) are determined by lifetime earned points and define an earn multiplier and a free-shipping threshold. A customer only moves up in MVP.
- FR-19.5 The tier free-shipping threshold is evaluated against the cart subtotal after the coupon discount and before point redemption.
- FR-19.6 Admins may adjust points manually with a required reason, audit-logged. Employees may not.

### FR-17 Payments

- FR-17.1 MVP payment methods: `cod`, `bank_transfer`, `momo_manual`.
- FR-17.2 MVP payment statuses: `unpaid`, `paid`.
- FR-17.3 All new orders start as `unpaid`.
- FR-17.4 Admins and employees can manually update payment status after offline verification.
- FR-17.5 Customers cannot update payment status.
- FR-17.6 MoMo gateway, bank gateway, IPN/callback, and automatic verification are Phase 2.

### FR-18 Audit Logging

- FR-18.1 Audit log is mandatory for admin/employee operations.
- FR-18.2 Log product create/update/delete.
- FR-18.3 Log category and brand changes.
- FR-18.4 Log order status changes.
- FR-18.5 Log payment status changes.
- FR-18.6 Log staff role/status changes.
- FR-18.7 Audit records include actor, action, entity type, entity id, timestamp, and optional details.

## 7. Data Model Reference

Core entities:

- User
- Address
- Role / permission
- Brand
- Category
- Product
- Cart / cart item
- Order / order item
- Order status event
- Payment
- Audit log

Use `erd.md` as the detailed entity reference.

## 8. Product Data Requirements

Product fields should support Vietnamese skincare content:

- Name
- Slug
- SKU
- Brand
- Category
- Original price
- Sale price
- Discount percentage, derived when possible
- Stock quantity
- Images
- Active/inactive state
- Short description
- Full description
- Ingredients
- Benefits
- How to use
- Tags
- Rating average/count when reviews exist

Seed data should include Vietnamese categories such as Serum, Kem Duong, Toner, Sua Rua Mat, Mat Na, and Kem Chong Nang.

## 9. UX Requirements

- Mobile-first storefront.
- Vietnamese-friendly product content and VND currency formatting.
- Clear add-to-cart, cart, checkout, order status, and error states.
- Admin/employee UI should be dense, clear, and operational rather than decorative.
- Protected screens must handle loading, anonymous access, unauthorized access, empty data, and API errors.
- Basic accessibility: keyboard reachable controls, visible focus, readable contrast, proper labels.

## 10. Non-Functional Requirements

- Security: hashed passwords, secure JWT/session handling, backend RBAC, no secrets in source.
- Privacy: avoid exposing customer data to unauthorized roles.
- Reliability: order, payment, stock, and audit changes should be transaction-safe where possible.
- Performance: product listing should be paginated; admin tables should not fetch unbounded data.
- Maintainability: prefer simple module boundaries and avoid speculative abstractions.
- Observability: log server errors and operational audit events.

## 11. Final Stack And Deployment

- Frontend: React + Vite + TypeScript.
- Backend: Node.js + Express + TypeScript.
- Database: MongoDB + Mongoose.
- API style: REST.
- Auth: secure JWT/session with backend RBAC.
- Deployment target: DigitalOcean Droplet + PM2/Nginx, with MongoDB Atlas or managed MongoDB.

## 12. Suggested API Surface

Use these routes as a starting contract, not as mandatory exact paths:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /products`
- `GET /products/:slug`
- `GET /categories`
- `GET /brands`
- `GET /cart`
- `POST /cart/items`
- `PATCH /cart/items/:id`
- `DELETE /cart/items/:id`
- `GET /addresses`
- `POST /addresses`
- `PATCH /addresses/:id`
- `DELETE /addresses/:id`
- `PATCH /addresses/:id/default`
- `POST /orders`
- `GET /orders`
- `GET /orders/:orderNo`
- `GET /employee/orders`
- `GET /employee/orders/:orderNo`
- `PATCH /employee/orders/:orderNo/status`
- `PATCH /employee/orders/:orderNo/payment`
- `GET /admin/dashboard`
- `GET /admin/products`
- `POST /admin/products`
- `POST /admin/products/:id/images`
- `PATCH /admin/products/:id/images/:imageId`
- `DELETE /admin/products/:id/images/:imageId`
- `PATCH /admin/products/:id`
- `DELETE /admin/products/:id`
- `GET /admin/categories`
- `POST /admin/categories`
- `PATCH /admin/categories/:id`
- `DELETE /admin/categories/:id`
- `GET /admin/brands`
- `POST /admin/brands`
- `PATCH /admin/brands/:id`
- `DELETE /admin/brands/:id`
- `GET /admin/orders`
- `GET /admin/orders/:orderNo`
- `PATCH /admin/orders/:orderNo/status`
- `PATCH /admin/orders/:orderNo/payment`
- `GET /admin/customers`
- `GET /admin/customers/:id`
- `PATCH /admin/customers/:id/status`
- `GET /admin/staff`
- `POST /admin/staff`
- `PATCH /admin/staff/:id/role`
- `PATCH /admin/staff/:id/status`
- `GET /admin/audit-logs`

## 13. Acceptance Criteria For A Clean Rebuild

- Customer can register/login, browse products, add to cart, checkout, and see their order.
- Customer cannot access another customer's orders.
- Employee can process orders through valid status transitions only.
- Admin can manage catalog, customers, staff, orders, and payment state.
- RBAC is enforced by backend tests or reliable API checks.
- Inventory reservation/deduction rules are verified.
- Payment does not become paid without Admin or Employee manual action.
- Paid payment changes set `paidAt`; paid-to-unpaid corrections clear `paidAt` and are audited.
- Admin revenue uses paid non-cancelled orders by `paidAt`.
- Product image management uploads, replaces, and deletes 1-6 images under `/uploads/products`, persists only URL/path metadata, and storefront product APIs return image URLs.
- Audit logs are written for operational changes.
- Seed data makes all main flows testable locally.

## 14. Recommended Companion Files

Existing files to keep:

- `descriptions.md`: short AI handoff and project story.
- `api-spec.md`: API reference.
- `erd.md`: data model reference.
- `qa-feature-regression.md`: regression checklist.
- `public/`: reusable logos and seed/static product images.

Add later only if needed:

- `docs/mvp-plan.md` for phased delivery.
- `docs/payment-design.md` if MoMo gateway, bank gateway, or payment callbacks enter active implementation.
- `docs/admin-rbac.md` if roles/permissions become more complex than admin/employee/customer.
