---
title: DrDo.vn Clean MVP PRD
status: draft
created: 2026-07-09
updated: 2026-07-26
---

# DrDo.vn Clean MVP PRD

## 1. Updated MVP Scope

DrDo.vn MVP is a Vietnamese skincare e-commerce rebuild focused on the smallest operating loop that can sell products and let staff run daily fulfillment.

In scope:

- Public storefront: home, product list, search, filters, sorting, product detail.
- Authentication and RBAC: customer registration/login, staff login, current profile, blocked-account handling, backend-enforced role access.
- Customer commerce: persistent cart, customer saved addresses, checkout, order creation, cart cleanup, customer order list/detail.
- Manual payments only: checkout records selected method (`cod`, `bank_transfer`, or `momo_manual`) and creates an unpaid order; Admin or Employee updates payment status after offline verification.
- Order operations: employee/admin order list/detail, valid status transitions, inventory effects, status history.
- Admin operations: dashboard metrics, low-stock list, product/category/brand management, customer blocking, staff management.
- Product image uploads: local server storage under `/uploads/products`, 1-6 images per product, Admin upload/replace/delete, URL/path metadata stored in MongoDB, public storefront reads image URLs.
- Customer engagement: wishlist, product reviews and ratings, and storefront banners.
- Loyalty and memberships: 1 point per 1,000 VND spent on shipped orders, point redemption at checkout, and four membership tiers with earn-multiplier and free-shipping benefits.
- Promotions and coupons (Phase 1): discount rules, coupon codes, checkout validation/redemption, and Admin-only coupon management.
- Audit logging: operational changes for order status, payment status, catalog, category/brand, customer status, and staff changes.
- Seed data: Vietnamese skincare products, categories, brands, customer, employee, admin, carts/orders useful for local checks.

Payment integration is not in MVP. There is no MoMo gateway, bank gateway, IPN/callback, webhook settlement, or automatic payment verification.

## 2. User Personas

- Customer: Vietnamese skincare buyer, usually mobile-first, wants to find products, understand price/stock/usage, place an order, and track status.
- Employee: daily operations staff member who processes orders, checks fulfillment details, updates order status, and manually records payment status when assigned.
- Admin: business operator who owns catalog, customers, staff, payment state, dashboard oversight, and audit accountability.

## 3. Use Cases / User Journeys

### Customer Purchase Journey

1. Customer opens storefront.
2. Customer browses or searches skincare products.
3. Customer filters by category, brand, price, or availability.
4. Customer opens product detail and reviews price, images, ingredients, benefits, usage, and stock state.
5. Customer adds available products to cart.
6. Customer updates quantities or removes items.
7. Customer saves products to a wishlist and can move wishlist items into the cart.
8. Customer checks out with a saved shipping address or inline shipping/contact information and payment method, optionally applying a coupon code and redeeming loyalty points.
9. System creates an order with `orderStatus=pending` and `paymentStatus=unpaid`, snapshotting any discount and redeemed points.
10. Customer views order detail, payment method, payment status, item snapshots, totals, discounts, shipping/contact snapshot, and status timeline.
11. After the order is paid, the customer earns loyalty points and can leave a product review.

### Employee Order Journey

1. Employee logs in.
2. Employee opens order dashboard.
3. Employee filters pending/processing orders.
4. Employee opens an order detail.
5. Employee advances allowed order status transitions.
6. Employee updates payment status only after manual verification.
7. System records inventory effects and audit logs.

### Admin Operations Journey

1. Admin logs in.
2. Admin reviews total orders, revenue, order status counts, and low-stock products.
3. Admin manages products, categories, and brands.
4. Admin views all orders and can update order/payment status.
5. Admin views customers and blocks/unblocks accounts.
6. Admin manages employee/admin staff accounts.
7. Admin manages storefront banners and moderates pending product reviews.
8. Admin manages promotions and coupon codes and reviews their usage.
9. Admin configures membership tiers and loyalty earn/redeem rules and can adjust customer points with a reason.
10. System records audit logs for sensitive changes.

## 4. Functional Requirements

### FR-01 Auth and RBAC

- FR-01.1 Customer registration creates a customer account.
- FR-01.2 All roles can log in with secure credentials.
- FR-01.3 Authenticated users can fetch their current profile from `GET /auth/me`.
- FR-01.4 Blocked users cannot log in or use protected APIs.
- FR-01.5 Backend APIs enforce authorization; frontend checks are UX only.
- FR-01.6 Unauthorized requests return `401` or `403` as appropriate.

### FR-02 Storefront Catalog

- FR-02.1 Customers can list active products with pagination.
- FR-02.2 Customers can search by keyword.
- FR-02.3 Customers can filter by category, brand, price range, and availability.
- FR-02.4 Customers can sort by newest, price ascending, price descending, and popularity.
- FR-02.5 Product detail shows images, name, price, sale price, brand, category, stock state, description, ingredients, benefits, and usage instructions when present.
- FR-02.6 Inactive products are hidden from normal storefront browsing.
- FR-02.7 Out-of-stock products cannot be checked out.

### FR-03 Cart and Checkout

- FR-03.1 Authenticated customers have one persistent cart.
- FR-03.2 Cart supports add, duplicate quantity merge, update quantity, and remove.
- FR-03.3 Cart rejects inactive products and quantities above available stock.
- FR-03.4 Checkout requires shipping/contact information.
- FR-03.5 Checkout creates an order with item price, product name, SKU, quantity, and line-total snapshots, plus the totals block defined in FR-09.7.
- FR-03.6 New orders start with `orderStatus=pending`.
- FR-03.7 New orders start with `paymentStatus=unpaid`; checkout never marks an order paid.
- FR-03.8 Cart is cleared after successful order creation.
- FR-03.9 Customers can list, create, edit, delete, and set a default saved shipping address.
- FR-03.10 Checkout can copy shipping/contact fields from a saved address or inline checkout input.
- FR-03.11 Orders store an immutable shipping/contact snapshot without postal code.

### FR-04 Orders, Inventory, and Payment State

- FR-04.1 Customers can view only their own order list/detail.
- FR-04.2 Employees and admins can list and view all orders.
- FR-04.3 Valid status transitions are `pending -> processing -> shipped -> delivered`.
- FR-04.4 `pending` and `processing` can transition to `cancelled`.
- FR-04.5 `delivered` and `cancelled` are final.
- FR-04.6 Checkout reserves stock.
- FR-04.7 Shipping deducts stock on hand.
- FR-04.8 Cancellation before shipping releases reserved stock.
- FR-04.9 Admins and employees can manually update payment status after offline verification.
- FR-04.10 Payment status changes record actor, previous status, next status, reason/note when supplied, and timestamp.
- FR-04.11 Cancellation after `shipped` is blocked in MVP; returns, refunds, and reversal after shipment are Phase 2.
- FR-04.12 MVP payment statuses are only `unpaid` and `paid`.

### FR-05 Admin Operations

- FR-05.1 Admin dashboard shows orders/revenue today and this week, order counts by status, and low-stock products.
- FR-05.2 Admins can create, edit, soft delete, activate, and deactivate products.
- FR-05.3 Admins can create, edit, and soft delete categories and brands.
- FR-05.4 Deleting categories or brands assigned to products is blocked.
- FR-05.5 Admins can view/search customers and block/unblock accounts.
- FR-05.6 Admins can view, create, activate/deactivate, and assign roles to staff.
- FR-05.7 Admins cannot deactivate their own active account.
- FR-05.7a Coupon and promotion management is Admin-only (FR-09.1), as is membership tier configuration and manual loyalty point adjustment (FR-08.11, FR-08.13).
- FR-05.8 MVP revenue is the sum of `grandTotal` for orders where `paymentStatus=paid` and `orderStatus != cancelled`, counted by `paidAt`.
- FR-05.9 Product image management stores files under `/uploads/products`, stores only URL/path metadata in MongoDB, supports 1-6 images per product, and lets Admin upload, replace, and delete images.
- FR-05.10 Public storefront reads product image URLs normally from product data.

### FR-06 Audit

- FR-06.1 Audit logs are required for admin/employee operations.
- FR-06.2 Audit logs cover product/category/brand changes, order status changes, payment status changes, customer status changes, staff role/status changes, review moderation actions, banner changes, promotion/coupon changes, and manual loyalty point adjustments.
- FR-06.3 Audit records include actor, action, entity type, entity id, timestamp, and details when useful.

### FR-07 Wishlist, Reviews, and Banners

- FR-07.1 Authenticated customers have one persistent wishlist and can add, remove, and list wishlist items.
- FR-07.2 Wishlist entries show current price, sale price, and stock state, and support moving an item into the cart.
- FR-07.3 Inactive or deleted products are hidden from wishlist browsing without breaking the list.
- FR-07.4 Customers can submit one review per product with a 1-5 star rating and optional text.
- FR-07.5 Customers can edit or delete their own review; admins and employees can delete any review.
- FR-07.6 Reviews are moderated: a new review starts `pending` and is only publicly visible after admin/employee approval.
- FR-07.7 Product detail and product list expose average rating and review count derived from approved reviews only.
- FR-07.8 Admins can create, edit, reorder, activate/deactivate, and soft delete storefront banners.
- FR-07.9 Banners store an image, optional title/subtitle, optional link target, display order, and active date range.
- FR-07.10 Storefront home renders only active banners whose date range covers the current time, in display order.
- FR-07.11 Banner images use the same local upload storage and metadata rules as product images (FR-05.9).

### FR-08 Loyalty and Memberships

- FR-08.1 Each customer has a loyalty account with a current point balance, a lifetime earned-point total, and a membership tier.
- FR-08.2 Points accrue when an order reaches `orderStatus=shipped`. Nothing accrues at `pending`, `processing`, or `cancelled`, and shipping is the single accrual trigger.
- FR-08.3 The earn base is the amount the customer actually pays for goods: `grandTotal` minus the shipping fee, after coupon discount and point redemption. Base points are `floor(earnBase / 1000)` — 1 point per 1,000 VND spent.
- FR-08.4 Awarded points are `floor(basePoints * tierEarnMultiplier)`, using the customer's tier at the moment of shipment.
- FR-08.5 Points accrue at most once per order; re-entering or replaying `shipped` never awards a second time.
- FR-08.6 Because cancellation after `shipped` is blocked in MVP (FR-04.11), accrual has no automatic reversal path. Any correction is a manual admin adjustment (FR-08.11).
- FR-08.7 Customers can redeem points at checkout for a discount at 10 VND per point, in multiples of 100 points, bounded by their balance and capped at 20% of the cart subtotal.
- FR-08.8 Redeemed points are deducted at order creation and are not returned if the order is later cancelled before shipping in MVP; refunding them is a manual admin adjustment.
- FR-08.9 Every point change writes a ledger entry with actor, order reference when applicable, delta, resulting balance, reason, and timestamp; balances and lifetime totals are derived from the ledger, never stored as a standalone mutable counter.
- FR-08.10 Customers can view their point balance, tier, progress to the next tier, and point history.
- FR-08.11 Admins can view a customer's loyalty account and make manual point adjustments with a required reason; adjustments are audit-logged (FR-06.2). Employees cannot adjust points.

#### FR-08.12 Membership Tiers

Tier is determined by lifetime earned points (redemption never lowers a tier). Tiers are seeded with these values and are admin-configurable:

| Tier | Lifetime points | Approx. lifetime spend | Earn multiplier | Free shipping over | Other benefits |
|---|---|---|---|---|---|
| Đồng (Bronze) | 0 | 0đ | 1.0x | — | Default tier for every new customer |
| Bạc (Silver) | 2,000 | 2,000,000đ | 1.1x | 500,000đ | Eligible for Silver-and-above promotions |
| Vàng (Gold) | 5,000 | 5,000,000đ | 1.25x | 300,000đ | Eligible for Gold-and-above promotions |
| Bạch Kim (Platinum) | 15,000 | 15,000,000đ | 1.5x | 0đ (always free) | Eligible for all tier-restricted promotions |

- FR-08.13 A tier defines a name, lifetime-point threshold, earn multiplier, free-shipping threshold, and display order.
- FR-08.14 Tier is recalculated immediately after each accrual; a customer only moves up in MVP, and tier changes are recorded in the ledger.
- FR-08.15 The tier free-shipping threshold is evaluated against cart subtotal after discounts and sets the shipping fee to 0 when met.
- FR-08.16 Tier benefits feed promotion eligibility (FR-09.3) so promotions can be restricted to one or more tiers.

### FR-09 Promotions and Coupons

Promotions and coupons are Phase 1 / MVP scope. This supersedes ADR-0004.

- FR-09.1 Only Admins can create, edit, enable/disable, and delete promotions and coupon codes. Employees have no write access to coupons and cannot create, edit, enable, disable, or delete them; the restriction is enforced backend-side per FR-01.5.
- FR-09.1a Employees may view coupons and their usage read-only in order context, so they can explain a discount on an order they are processing.
- FR-09.1b Coupon deletion is a soft delete. A deleted or disabled coupon stops validating at checkout immediately but stays resolvable from historical orders that already redeemed it.
- FR-09.2 A promotion defines a discount type (percentage or fixed amount), a value, and an optional maximum discount cap.
- FR-09.3 A promotion defines eligibility: active date range, minimum order total, applicable products/categories/brands, and applicable membership tiers.
- FR-09.4 A coupon defines a unique case-insensitive code, a total usage limit, and a per-customer usage limit.
- FR-09.5 Customers can apply one coupon code per order at checkout; stacking multiple coupons is not supported.
- FR-09.6 Checkout validates a coupon server-side and rejects codes that are unknown, inactive, expired, over limit, or ineligible for the cart, with a distinct error per reason.
- FR-09.7 Every order records a totals block with exactly these fields:

  | Field | Meaning |
  |---|---|
  | `subtotal` | Sum of item line totals before any discount |
  | `discountAmount` | VND removed by the applied coupon/promotion |
  | `couponRef` | Reference to the redeemed coupon, plus a snapshot of its code and rule; null when none |
  | `pointsRedeemed` | Loyalty points spent on this order |
  | `pointsDiscountAmount` | VND value of `pointsRedeemed` at the FR-08.7 rate |
  | `shippingFee` | Shipping charged, 0 when a tier free-shipping benefit applies |
  | `grandTotal` | `subtotal - discountAmount - pointsDiscountAmount + shippingFee` |

- FR-09.7a Totals are computed server-side at checkout; client-supplied totals are never trusted.
- FR-09.7b `grandTotal` is clamped at a minimum of 0 and can never be negative. Discounts never reduce the shipping fee below 0 or generate a refund.
- FR-09.7c All totals fields are stored on the order even when zero, so historical orders have a uniform shape.
- FR-09.8 Applying a coupon records a redemption tied to the order and customer; cancelling the order releases that redemption against usage limits.
- FR-09.9 Discount and coupon fields are captured as an immutable snapshot on the order, so later promotion edits do not change historical orders.
- FR-09.10 Admins can view coupon usage counts and redemptions.
- FR-09.11 Revenue reporting (FR-05.8) uses `grandTotal` after discounts and point redemption.

## 5. Out Of Scope

- MoMo gateway, IPN, callback handling, signature verification, or automatic MoMo payment settlement.
- Bank gateway integration, bank webhook/callback handling, or automatic bank transfer verification.
- Any checkout path that marks an order paid without Admin/Employee action.
- Payment provider configuration screens.
- Native mobile app.
- Marketplace or third-party sellers.
- Product variants/SKU matrix.
- Complex warehouse/multi-location inventory.
- Accounting integration.
- Advanced analytics, charts, delivered-only revenue reporting, export, saved filters, scheduled reports, and bulk admin workflows.
- Email/SMS notifications and system-wide settings.
- 2FA unless admin security becomes a launch requirement.
- S3, Cloudinary, MinIO, CDN, image transformation pipeline, and complex media manager.

## 6. Resolved Technical Decisions

- Stack: React + Vite + TypeScript frontend; Node.js + Express + TypeScript backend; MongoDB + Mongoose; REST API; secure JWT/session auth with backend RBAC.
- Deployment: DigitalOcean Droplet with PM2/Nginx, using MongoDB Atlas or managed MongoDB.
- Product images: local server upload storage under `/uploads/products`, 1-6 images per product, Admin upload/replace/delete, URL/path metadata in MongoDB, and storefront image URLs read from product data.
- Revenue: paid non-cancelled orders counted by `paidAt` using post-discount `grandTotal`; delivered-only revenue is Phase 2 reporting.
- Banner images: same local upload storage, path metadata, and Admin upload/replace/delete rules as product images.
- Reviews: moderated (approval required before public display) to avoid unfiltered user content on a skincare storefront.
- Coupons: Phase 1, Admin-only management (supersedes ADR-0004), one coupon per order, validated server-side, with an immutable discount snapshot on the order.
- Loyalty accrual: triggered at `shipped`, not at `paid`. Under manual payments a `paid` flag is a human judgement call, whereas `shipped` means goods actually left — that makes shipment the more defensible point to hand out value, and it sidesteps reversal entirely since post-shipment cancellation is already blocked (FR-04.11).
- Loyalty: point balances derived from an append-only ledger rather than a mutable counter, so accrual, redemption, and manual adjustment are auditable.
- Order totals: a fixed seven-field block on every order (FR-09.7), computed server-side, always stored even when zero.

## 7. MVP UX and Non-Functional Requirements

- Storefront is mobile-first and uses Vietnamese-ready text and VND formatting.
- Protected screens handle loading, anonymous access, unauthorized access, empty data, and API errors.
- Basic accessibility is required: keyboard reachable controls, visible focus, readable contrast, and proper labels.
- Product list and admin table APIs are paginated or otherwise bounded.
- Server errors are logged without leaking secrets or customer data.
- MVP deployment has a documented backup/restore expectation for MongoDB data and local uploaded product images.

## 8. Verification

Use `docs/qa-feature-regression.md` as the MVP regression checklist. Promo, wishlist, review, banner, loyalty, and membership rows are now in scope and must be covered by the checklist. Track payment-provider, advanced analytics, and export rows as Phase 2.
