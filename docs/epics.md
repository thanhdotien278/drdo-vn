---
title: DrDo.vn MVP Epics and Stories
status: draft
created: 2026-07-09
updated: 2026-07-09
---

# DrDo.vn MVP Epics and Stories

## Epic 1: Foundation, Auth, and RBAC

Goal: establish the clean rebuild foundation, seeded roles, and backend authorization contract.

### Story 1.1 Project scaffold and source contract

As a developer, I want a clean project scaffold and documented source contract so the rebuild does not inherit old implementation assumptions.

Acceptance criteria:

- Project has runnable web/API structure.
- Docs identify `docs/requirements.md`, `docs/descriptions.md`, `docs/erd.md`, `docs/api-spec.md`, `docs/admin-dashboard-mvp.md`, and `docs/qa-feature-regression.md` as source references.
- Build/start commands are documented.
- No old DrDo2 code structure is copied without an explicit reason.

### Story 1.2 Auth baseline

As a customer or staff user, I want to register or log in so protected features know my identity.

Acceptance criteria:

- Customer registration creates a customer-role account.
- Login works for customer, employee, and admin.
- `GET /auth/me` returns authenticated user identity and roles.
- Blocked users cannot log in or call protected APIs.
- Anonymous protected API requests return `401`.

### Story 1.3 Backend RBAC

As the business owner, I want backend-enforced role access so frontend checks are not the security boundary.

Acceptance criteria:

- Customer cannot access employee/admin APIs.
- Employee can access order/payment operations allowed by MVP and cannot manage catalog, customers, staff, reports, or settings.
- Admin can access all MVP admin APIs.
- Unauthorized role access returns `403`.
- Protected dashboard routes handle anonymous and unauthorized users.

### Story 1.4 Seed data

As a tester, I want realistic seed data so MVP flows can be verified locally.

Acceptance criteria:

- Seed includes admin, employee, and customer accounts.
- Seed includes Vietnamese skincare categories, brands, and active products.
- Seed includes at least one low-stock product.
- Seed includes sample unpaid/manual-payment orders across statuses.

## Epic 2: Storefront Catalog

Goal: customers can discover available skincare products.

### Story 2.1 Product/category/brand public APIs

As a customer, I want to browse products, categories, and brands so I can find relevant items.

Acceptance criteria:

- `GET /products` returns paginated active products.
- `GET /categories` returns active categories.
- `GET /brands` returns active brands.
- Inactive products are hidden from normal storefront browsing.
- Product prices are returned in VND-compatible fields.

### Story 2.2 Search, filters, sorting, and availability

As a customer, I want search/filter/sort controls so I can narrow the catalog.

Acceptance criteria:

- Product list supports keyword search.
- Product list supports category, brand, price range, and availability filters.
- Product list supports newest, price ascending, price descending, and popularity sort.
- Pagination prevents unbounded responses.
- Out-of-stock products are visibly unavailable for checkout.

### Story 2.3 Product detail

As a customer, I want detailed product information so I can decide whether to buy.

Acceptance criteria:

- Product detail loads by slug.
- Detail shows images, name, price/sale price, brand, category, stock state, description, ingredients, benefits, and usage when present.
- Unknown slug returns `404` from the API and the page renders a non-broken not-found state.
- Inactive product detail is not exposed through normal storefront access.

### Story 2.4 Storefront home

As a customer, I want a simple home page so I can start shopping quickly.

Acceptance criteria:

- Home renders product/category sections from real data.
- Empty data has a non-broken state.
- Product links navigate to detail pages.
- UI uses mobile-friendly VND formatting and Vietnamese-ready text.

## Epic 3: Cart, Checkout, and Customer Orders

Goal: customers can create and track unpaid/manual-payment orders.

### Story 3.1 Persistent customer cart

As a customer, I want my cart saved so I can continue checkout after browsing.

Acceptance criteria:

- Authenticated customer has one persistent cart.
- Add item creates or updates an existing cart item.
- Quantity update recalculates totals.
- Remove item updates cart totals.
- Cart rejects inactive products.

### Story 3.2 Cart stock validation

As a customer, I want stock limits enforced so I cannot order unavailable quantity.

Acceptance criteria:

- Add/update rejects quantity above available stock.
- Checkout rejects empty cart.
- Checkout rejects inactive products.
- Checkout rejects quantities above available stock at final order creation time.

### Story 3.3 Customer saved addresses

As a customer, I want to manage saved shipping addresses so checkout can reuse my delivery details.

Acceptance criteria:

- Customer can list their own saved shipping addresses.
- Customer can create a saved shipping address without postal code.
- Customer can edit and delete only their own saved shipping addresses.
- Customer can set one default saved shipping address.
- Editing or deleting a saved address does not change existing order shipping snapshots.

### Story 3.4 Checkout creates manual-payment order

As a customer, I want to submit checkout details and payment method so an order is created.

Acceptance criteria:

- Checkout requires shipping/contact fields from either a saved address or inline checkout input.
- Checkout accepts `cod`, `bank_transfer`, or `momo_manual` as selected method labels.
- Created order starts with `orderStatus=pending`.
- Created order starts with `paymentStatus=unpaid` and is never marked paid by checkout.
- Created order stores an immutable shipping/contact snapshot without postal code.
- Order items snapshot product name, SKU, unit price, quantity, and line total.
- Cart is cleared after successful order creation.

### Story 3.5 Customer order list/detail

As a customer, I want to view my orders so I can track fulfillment and payment state.

Acceptance criteria:

- Customer sees only their own orders.
- Order list is newest first.
- Order detail shows timeline, items, totals, payment method, payment status, shipping/contact snapshot, and order status.
- Customer cannot mutate order status or payment status.

### Story 3.6 Inventory reservation and cancellation release

As the business, I want inventory reserved during checkout so stock stays consistent.

Acceptance criteria:

- Checkout reserves stock without deducting stock on hand.
- Cancellation before shipment releases reserved stock.
- Reserved stock plus stock on hand remains consistent after checkout, pre-shipment cancellation, and shipment.
- Inventory-affecting changes are auditable.

## Epic 4: Employee Order and Manual Payment Operations

Goal: employees can process orders and manually update payment state without broader admin access.

### Story 4.1 Employee order list/detail

As an employee, I want to see orders and fulfillment details so I can process them.

Acceptance criteria:

- Employee can list orders.
- Employee can filter orders by status.
- Employee can open order detail.
- Detail includes customer/shipping/support information needed for fulfillment.
- Employee cannot access catalog, customer management, staff management, reports, or settings.

### Story 4.2 Shared order status transitions

As an employee, I want valid status transitions so order workflow remains consistent.

Acceptance criteria:

- `pending -> processing` succeeds.
- `processing -> shipped` succeeds.
- `shipped -> delivered` succeeds.
- `pending/processing -> cancelled` succeeds.
- Backward transitions are rejected.
- Delivered and cancelled orders are final.

### Story 4.3 Inventory deduction on shipped

As the business, I want stock deducted only when an order ships.

Acceptance criteria:

- Moving to shipped deducts stock on hand.
- Moving to shipped clears or consumes reserved stock for the order.
- Duplicate shipment transition cannot double-deduct stock.
- Cancellation after shipped is blocked in MVP.

### Story 4.4 Manual payment status update

As an employee, I want to update payment status after offline verification so orders reflect reality without payment gateway integration.

Acceptance criteria:

- Employee can update payment status only through the authorized order operation.
- Payment status never changes from gateway, IPN, callback, or automatic verification in MVP.
- Payment update requires `paymentStatus=unpaid` or `paymentStatus=paid` and supports an optional note/reason.
- Payment update records actor, previous status, next status, timestamp, and note/reason when supplied.
- Customer cannot call the payment update API.

### Story 4.5 Status and audit logging

As the business, I want operational changes logged so staff actions are traceable.

Acceptance criteria:

- Every order status change creates a status event.
- Every order status change creates an audit log.
- Every payment status change creates an audit log.
- Audit log includes actor, action, entity type, entity id, timestamp, previous value, next value, and note/reason when supplied.

## Epic 5: Admin MVP Operations

Goal: admins can operate catalog, customers, staff, orders, payment state, and dashboard basics.

### Story 5.1 Admin dashboard metrics

As an admin, I want basic dashboard metrics so I can see daily operations.

Acceptance criteria:

- Dashboard shows total orders today and this week.
- Dashboard shows revenue today and this week.
- Dashboard shows orders grouped by status.
- Dashboard shows low-stock products.
- Dashboard uses simple tables/counts, no advanced charts.
- Revenue is the sum of `grandTotal` for orders where `paymentStatus=paid` and `orderStatus != cancelled`.
- Revenue is counted by `paidAt`, not order creation date.
- Delivered-only revenue reporting is not part of MVP.

### Story 5.2 Product management

As an admin, I want to manage products so the storefront stays current.

Acceptance criteria:

- Admin can create products with required fields.
- Admin can edit product details, prices, stock, images, category, brand, and active status.
- Admin can upload 1-6 product images stored under `/uploads/products`.
- Admin can replace and delete product images.
- Product records store image URL/path metadata only.
- Public storefront product list/detail can render stored image URLs.
- Admin can soft delete products.
- Product create, edit, soft-delete, activation/deactivation, and image changes are audited.
- Missing required fields and invalid numeric values are rejected.
- Product changes appear in storefront browsing when active.

### Story 5.3 Category and brand management

As an admin, I want to manage categories and brands so products stay organized.

Acceptance criteria:

- Admin can create/edit/soft delete categories.
- Admin can create/edit/soft delete brands.
- Delete is blocked when products reference the category or brand.
- Delete blocked by assigned products returns a rejection response and an admin-readable reason.
- Category/brand changes are audited.

### Story 5.4 Customer management

As an admin, I want to view and block customers so I can manage risky accounts.

Acceptance criteria:

- Admin can view customer list.
- Admin can search customers by name, email, or phone.
- Admin can view customer profile and order history.
- Admin can block/unblock customers.
- Blocked customer cannot log in or use protected APIs.
- Customer status changes are audited.

### Story 5.5 Staff management

As an admin, I want to manage staff accounts so the right people have the right access.

Acceptance criteria:

- Admin can view staff list.
- Admin can create staff accounts.
- Admin can assign admin or employee role.
- Admin can activate/deactivate staff.
- Admin cannot deactivate their own active account.
- Staff role/status changes are audited.

### Story 5.6 Admin order and manual payment management

As an admin, I want to manage orders and payment state so exceptions can be handled.

Acceptance criteria:

- Admin can list all orders.
- Admin can view any order detail.
- Admin can update order status using the same transition rules as employees.
- Admin can manually set payment status to `unpaid` or `paid` after offline verification.
- Setting `paymentStatus` from `unpaid` to `paid` sets `paidAt`.
- Correcting `paymentStatus` from `paid` to `unpaid` clears `paidAt`.
- Admin payment updates are audited.
- No MoMo gateway, bank gateway, IPN/callback, or automatic verification path exists in MVP.

## Epic 6: MVP Verification

Goal: prove the MVP against the regression checklist without testing Phase 2 features as MVP blockers.

### Story 6.1 API smoke checks

As a developer, I want API smoke checks so critical backend rules do not regress.

Acceptance criteria:

- Auth/RBAC checks cover customer, employee, admin, anonymous, and blocked user cases.
- Catalog checks cover list, detail, filter/sort/search, inactive, and out-of-stock behavior.
- Cart/checkout checks cover stock validation, order creation, cart cleanup, and unpaid/manual payment state.
- Employee/admin checks cover order status and payment status authorization.

### Story 6.2 Customer journey browser check

As a tester, I want a browser check for the customer flow so the storefront works end to end.

Acceptance criteria:

- Customer can browse product list and detail.
- Customer can add/update/remove cart items.
- Customer can create or select a saved shipping address.
- Customer can checkout with saved or inline shipping/contact information and payment method.
- Created order appears in customer order history/detail.
- Payment status remains `unpaid` after checkout.

### Story 6.3 Employee journey browser check

As a tester, I want a browser check for employee operations so fulfillment works.

Acceptance criteria:

- Employee can log in and open order list/detail.
- Employee can perform valid order status transitions.
- Employee can manually update payment status.
- Employee cannot access admin-only catalog/customer/staff areas.
- Audit/status evidence is visible through API or database check.

### Story 6.4 Admin journey browser check

As a tester, I want a browser check for admin operations so business management works.

Acceptance criteria:

- Admin dashboard metrics render.
- Admin can create/edit/soft-delete a product.
- Admin can manage category/brand records with delete blocking.
- Admin can block/unblock customer.
- Admin can create/deactivate staff without deactivating self.
- Admin can manually update payment status.

## Epic 7: Customer Engagement (FR-07)

Added 2026-07-26 when the PRD pulled wishlist, moderated reviews, and storefront banners into MVP.

### Story 7.1: Wishlist persistence and management
As a customer, I want one persistent wishlist so that I can save products for later.
Acceptance criteria:
- Authenticated customers can add, remove, and list wishlist items.
- Adding a product already on the list is a no-op, not an error.
- Wishlists are isolated per customer.

### Story 7.2: Wishlist-to-cart and stock/price display
As a customer, I want my wishlist to show current price and stock so that I can decide whether to buy.
Acceptance criteria:
- Entries show current price, sale price, and stock state.
- An item can be moved into the cart, which removes it from the wishlist.
- Inactive or deleted products are hidden from browsing **without deleting the row**, so a returning product reappears.

### Story 7.3: Product review submission and ownership
As a customer, I want to review a product I bought so that other buyers benefit.
Acceptance criteria:
- Only a customer with a non-cancelled order containing the product may review it.
- One review per product per customer, 1-5 stars with optional text.
- Customers can edit or delete their own review; editing an approved review returns it to `pending`.

### Story 7.4: Review moderation and rating aggregation
As an admin or employee, I want to moderate reviews so that the storefront shows trustworthy content.
Acceptance criteria:
- A new review starts `pending` and is not publicly visible.
- Admins and employees can approve, reject, or delete any review; every action is audit-logged.
- Product list and detail expose average rating and review count derived from approved reviews only.

### Story 7.5: Storefront banner management and rendering
As an admin, I want to manage home banners so that campaigns can be scheduled.
Acceptance criteria:
- Admin can create, edit, reorder, activate/deactivate, and soft delete banners.
- Banner images follow the product-image storage rules under `/uploads/banners`.
- The storefront renders only active banners whose date range covers now, in display order.

## Epic 8: Loyalty and Memberships (FR-08)

### Story 8.1: Membership tiers and seeded tier configuration
Four tiers seeded with the exact PRD values; admin-configurable; `freeShippingThreshold` is tri-state (null = none, 0 = always free).

### Story 8.2: Loyalty ledger and derived balance
Append-only ledger; balance and lifetime totals derived by aggregation, never stored as a mutable counter.

### Story 8.3: Point accrual on shipped
Accrual fires only at `shipped`, at most once per order, enforced by a unique partial index; a row is written even when zero points are awarded.

### Story 8.4: Point redemption at checkout
10đ per point, multiples of 100, bounded by balance and capped at 20% of subtotal; rejected rather than silently reduced; deducted at order creation and not returned on cancellation.

### Story 8.5: Tier free-shipping benefit
Evaluated against the subtotal after the coupon discount and before point redemption, so redeeming points can never cost a customer their free shipping.

### Story 8.6: Customer loyalty view and point history
Balance, tier, progress to the next tier, and paginated point history.

### Story 8.7: Admin loyalty adjustment and tier config
Admin-only manual adjustment with a required reason, audit-logged. Employees cannot adjust points.

## Epic 9: Promotions and Coupons (FR-09)

### Story 9.1: Order totals block and discount snapshot
The fixed seven-field totals block on every order, computed server-side, always stored even when zero, with an immutable coupon snapshot.
**Executes in the foundation wave, before Story 3.4** — the epic numbering does not imply the build order.

### Story 9.2: Promotion/coupon data model and Admin management
Admin-only create/edit/enable/disable/soft-delete for promotions and coupons; employees have read-only visibility in order context.

### Story 9.3: Coupon validation at checkout
Server-side validation with a distinct error code per rejection reason; one coupon per order; promotion scope defines the discount base.

### Story 9.4: Coupon redemption, release, and usage reporting
Redemption recorded per order; cancellation releases it against usage limits; admin can view usage counts and redemptions.

## Execution Waves

Epic order is not build order. Story 9.1 (totals block) and Story 4.5 (audit logging) execute first as foundations, because checkout, order operations, loyalty, and promotions all depend on them.

| Wave | Content |
|---|---|
| 0 | Story 9.1 totals block, Story 4.5 audit logging, shared error/validation/pagination utilities, upload storage, seed registry, route and page seams |
| 1 | Stories 3.4-3.6 checkout and customer orders; Stories 4.1-4.4 employee order operations |
| 2 | Epic 5 admin operations |
| 3 | Epic 7 engagement, Epic 8 loyalty, Epic 9 promotions |
| 4 | Epic 6 verification and documentation alignment |

## Phase 2 Candidate Epics

- Real MoMo and bank transfer settlement workflows.
- Payment provider configuration and payment event logs.
- Advanced analytics, reports, export, saved filters, and bulk workflows.
- Notifications and settings.
- Returns/refunds and stock history.
