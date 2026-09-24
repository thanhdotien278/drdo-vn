# DrDo.vn API Specification v1

This is the MVP API contract. Payment provider integration is Phase 2 and intentionally absent here.

## Conventions

- All routes below are mounted under `/api` (e.g. `POST /api/auth/login`). `GET /health` is an operational health endpoint, not a business API, and stays outside `/api`; `GET /uploads/**` is also unversioned.
- Authenticated requests require an `Authorization: Bearer <jwt>` header; there is no session cookie.
- Anonymous protected requests return `401` (`UNAUTHORIZED`, `INVALID_TOKEN`, `USER_NOT_FOUND`, `ACCOUNT_BLOCKED`, or `ACCOUNT_INACTIVE`). Authenticated users without the required role return `403 FORBIDDEN`.
- Manual payment status values: `unpaid`, `paid`.
- MVP payment methods: `cod`, `bank_transfer`, `momo_manual`.
- Order status values: `pending`, `processing`, `shipped`, `delivered`, `cancelled`. The only legal transitions are `pending -> processing | cancelled`, `processing -> shipped | cancelled`, `shipped -> delivered`; `delivered` and `cancelled` are terminal.
- Revenue uses `paidAt` for orders where `paymentStatus=paid` and `orderStatus != cancelled`.
- Error bodies are always `{ error: { code, message, details? } }` with a SCREAMING_SNAKE `code`; validation failures carry flattened zod field errors in `details`.
- Collections return `{ data }`, or `{ data, meta: { page, limit, total, totalPages, hasNextPage, hasPrevPage } }` when paginated (`page` >= 1, `limit` 1-48, default 12). Single resources return `{ data: ... }`, with named keys nested inside `data` where a response carries more than one thing (`{ data: { user } }`, `{ data: { customer, orders } }`, …).
- Mutation responses always use the `{ data }` envelope. DELETE endpoints that do not need to return a resource (`/addresses/:id`, taxonomy deletes) return `{ data: { ok: true } }`; `DELETE /cart/items/:id` and the product/image deletes return the updated `{ data }` resource so the client can refresh state without a refetch.
- **Roles are exact.** An admin does not implicitly hold the `employee` role: the same order-operations handlers are mounted twice, once under `/employee/orders` and once under `/admin/orders`, and each role uses its own prefix.
- Every order carries the fixed seven-field totals block (`subtotal`, `discountAmount`, `couponRef`, `pointsRedeemed`, `pointsDiscountAmount`, `shippingFee`, `grandTotal`), always present even when zero, always computed server-side. `grandTotal = subtotal - discountAmount - pointsDiscountAmount + shippingFee`, clamped at 0.
- Uploaded images are served from `/uploads/**`; an `:imageId` path parameter **is the stored filename**.
- Staff mutations (order operations, catalog, customers, staff) write audit-log entries; reads are never audited.

## RBAC Matrix

| Route / Action | Public | Customer | Employee | Admin |
| --- | --- | --- | --- | --- |
| `POST /auth/register`, `POST /auth/login` | Yes | Yes | Yes | Yes |
| `GET /auth/me`, `POST /auth/logout` | No | Own profile | Own profile | Own profile |
| `GET /products`, `GET /products/featured`, `GET /products/:slug`, `GET /products/:slug/related`, `GET /categories`, `GET /brands` | Yes | Yes | Yes | Yes |
| `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id` | No | Own cart | No | No |
| `GET /addresses`, `POST /addresses`, `PATCH /addresses/:id`, `DELETE /addresses/:id`, `PATCH /addresses/:id/default` | No | Own addresses | No | No |
| `POST /orders`, `POST /orders/preview`, `GET /orders`, `GET /orders/:orderNo` | No | Own orders only | No | No |
| `GET /employee/orders`, `GET /employee/orders/:orderNo` | No | No | Yes | No |
| `PATCH /employee/orders/:orderNo/status`, `PATCH /employee/orders/:orderNo/payment` | No | No | Yes | No |
| `GET /employee/reviews`, `PATCH /employee/reviews/:id/status`, `DELETE /employee/reviews/:id` | No | No | Yes | No |
| `GET /wishlist`, `POST /wishlist/items`, `DELETE /wishlist/items/:productId`, `POST /wishlist/items/:productId/move-to-cart` | No | Own wishlist | No | No |
| `GET /products/:productId/reviews` | Yes | Yes | Yes | Yes |
| `POST /products/:productId/reviews`, `GET /products/:productId/reviews/me`, `PATCH /reviews/:id`, `DELETE /reviews/:id` | No | Own reviews | No | No |
| `GET /banners` | Yes | Yes | Yes | Yes |
| `GET /admin/reviews`, `PATCH /admin/reviews/:id/status`, `DELETE /admin/reviews/:id` | No | No | No | Yes |
| `GET /admin/banners`, `POST /admin/banners`, `PATCH /admin/banners/:id`, `DELETE /admin/banners/:id` | No | No | No | Yes |
| `GET /admin/dashboard`, `GET /admin/audit-logs` | No | No | No | Yes |
| `GET /admin/products`, `GET /admin/products/:id`, `POST /admin/products`, `PATCH /admin/products/:id`, `DELETE /admin/products/:id` | No | No | No | Yes |
| `POST /admin/products/:id/images`, `PATCH /admin/products/:id/images/:imageId`, `DELETE /admin/products/:id/images/:imageId` | No | No | No | Yes |
| `GET /admin/categories`, `POST /admin/categories`, `PATCH /admin/categories/:id`, `DELETE /admin/categories/:id` | No | No | No | Yes |
| `GET /admin/brands`, `POST /admin/brands`, `PATCH /admin/brands/:id`, `DELETE /admin/brands/:id` | No | No | No | Yes |
| `GET /admin/orders`, `GET /admin/orders/:orderNo` | No | No | No | Yes |
| `PATCH /admin/orders/:orderNo/status`, `PATCH /admin/orders/:orderNo/payment` | No | No | No | Yes |
| `GET /admin/customers`, `GET /admin/customers/:id`, `PATCH /admin/customers/:id/status` | No | No | No | Yes |
| `GET /admin/staff`, `POST /admin/staff`, `PATCH /admin/staff/:id/role`, `PATCH /admin/staff/:id/status` | No | No | No | Yes |
| `GET /admin/promotions`, `POST /admin/promotions`, `PATCH /admin/promotions/:id`, `DELETE /admin/promotions/:id` | No | No | No | Yes |
| `GET /admin/coupons`, `POST /admin/coupons`, `PATCH /admin/coupons/:id`, `DELETE /admin/coupons/:id`, `GET /admin/coupons/:id/redemptions` | No | No | No | Yes |
| `GET /uploads/**` | Yes | Yes | Yes | Yes |

Notes on this matrix:

- `POST /auth/register` has no role guard at all — anyone, including a logged-in staff account, can create a customer account. The payload carries no role field and client-supplied `roles`/`status` values are ignored: registration always creates a `customer` account; only `POST /admin/staff` may create staff.
- **Employees are excluded from the dashboard, catalog, customer, staff, and audit surfaces** (ADR-0010) — those routes exist only under `/admin` and require the exact `admin` role.
- `POST /orders/preview` exists because FR-09.7a forbids trusting client-computed totals: it is the only way the checkout screen can display the shipping fee or final `grandTotal` before submitting. Coupon and points fields stay zero until Epics 8-9 land.

## Authentication

- `POST /auth/register` - Register a new customer. Body `{ email, password (8-128 chars), fullName, phone? }`; returns `201 { data: { token, user } }` where `user` is `{ id, email, fullName, phone, roles, status }`. `409` when the email is already registered.
- `POST /auth/login` - Login for customer, employee, and admin. Body `{ email, password }`; returns `{ data: { token, user } }`. `401` on bad credentials; `403 ACCOUNT_BLOCKED` or `403 ACCOUNT_INACTIVE` when the account is not `active`.
- `GET /auth/me` - Get current user profile; returns `{ data: { user } }`.
- `POST /auth/logout` - Bearer tokens are stateless so logout is a client-side discard; this endpoint only confirms the request was authenticated and returns `{ data: { ok: true } }`.

## Catalog

All catalog routes are public and expose only active, non-deleted records.

- `GET /products` - List active products. Query: `page`, `limit`, `q` (matches name, shortDescription, slug, sku), `category` and `brand` (comma-separated **slugs**, max 20 each), `minPrice`, `maxPrice`, `availability` = `all | in_stock | out_of_stock`, `sort` = `newest | price_asc | price_desc | popular`. Returns `{ data: ProductListItem[], meta }`. `400` when `minPrice > maxPrice`.
- `GET /products/featured` - `{ data: { bestSellers, newArrivals, onSale } }`, up to 8 products each (`onSale` = `effectivePrice < price`).
- `GET /products/:slug` - Get active product detail by slug; `404` for unknown, inactive, or deleted products.
- `GET /products/:slug/related` - Up to 4 active products sharing the product's category or brand, best-sellers first.
- `GET /categories` - List active categories sorted by `displayOrder` then name.
- `GET /brands` - List active brands sorted by `displayOrder` then name.

`ProductListItem` is `{ id, name, slug, sku, shortDescription, price, salePrice, effectivePrice, discountPercent, images[{ url, alt, isPrimary }], category, brand, availableStock, inStock, ratingAverage, ratingCount, volume }`; the detail adds `description`, `ingredients`, `benefits[]`, `usageInstructions`, `skinTypes[]`.

## Cart

Customer role only; the cart is created lazily on first use.

- `GET /cart` - Get current customer's cart: `{ data: { id, items, itemCount, subtotal } }`. Each item is `{ id, product, qty, unitPrice, lineTotal }`; `unitPrice` is the stored snapshot while `product` carries the live `effectivePrice`, `availableStock`, `inStock`, and `purchasable` (false when the product was deactivated after being added; `product` is `null` when it no longer exists).
- `POST /cart/items` - Add or merge item into cart. Body `{ productId, qty? }` (`qty` 1-999, default 1); re-snapshots the price. Returns `201 { data: cart }`. Errors: `400 PRODUCT_UNAVAILABLE`, `400 INSUFFICIENT_STOCK` (`details` carry `productId` and `availableStock`).
- `PATCH /cart/items/:id` - Update cart item quantity. Body `{ qty }` (1-999); same stock errors; `404` when the item is not in the caller's cart.
- `DELETE /cart/items/:id` - Remove cart item; returns `{ data: cart }` (not `{ ok: true }`).

## Customer Addresses

Customer role only; addresses have no postal code. Body for create/update is `{ fullName, phone, line1, line2?, ward, district, province, isDefault? }` (partial on update). All routes are scoped to the caller — foreign or malformed ids return `404`.

- `GET /addresses` - List saved shipping addresses, default first then oldest.
- `POST /addresses` - Create a saved shipping address; `201`. The first saved address becomes default automatically; `isDefault: true` clears other defaults.
- `PATCH /addresses/:id` - Update a saved shipping address.
- `DELETE /addresses/:id` - Delete a saved shipping address; returns `{ data: { ok: true } }`. Deleting the default promotes the oldest remaining address.
- `PATCH /addresses/:id/default` - Set the default saved shipping address; returns `{ data: address }`.

## Customer Orders

Customer role only; customers see their own orders and have no status/payment mutation route.

- `POST /orders` - Create order from the current cart. Body `{ paymentMethod, addressId?, shipping?, contactEmail?, notesCustomer?, pointsToRedeem?, couponCode? }`: either `addressId` (a saved address owned by the caller) or an inline `shipping` object `{ fullName, phone, line1, line2?, ward, district, province }` is required. `couponCode` (trimmed, ≤50 chars, case-insensitive) resolves through the QA §14.5 validation ladder before stock is reserved; on success the order embeds the immutable `couponRef` snapshot (`couponId`, `promotionId`, `code`, `discountType`, `discountValue`, `maxDiscountAmount`) and one `applied` `CouponRedemption` row ties the coupon to the order. New orders are always `paymentStatus=unpaid`, `orderStatus=pending`; stock is **reserved** (not deducted) and the cart clears only after the order exists. Returns `201 { data: OrderDetail }`. Errors: `400 CART_EMPTY`, `400 SHIPPING_REQUIRED`, `400 PRODUCT_UNAVAILABLE`, `400 INSUFFICIENT_STOCK`, the coupon codes below, `404` for an `addressId` the caller does not own.
- `POST /orders/preview` - Server-computed totals for the checkout screen. Body `{ pointsToRedeem?, couponCode? }` (both optional); returns `{ data: { itemCount, totals, loyalty } }` with the full seven-field block. The same coupon validation as checkout applies, so the preview never disagrees with the resulting order. Same `CART_EMPTY`/`PRODUCT_UNAVAILABLE`/`INSUFFICIENT_STOCK` and coupon errors as checkout.

Coupon rejection codes (all `400`, checked in this order — QA §14.5): `COUPON_NOT_FOUND` (unknown or soft-deleted) → `COUPON_INACTIVE` (coupon or its promotion disabled/deleted — indistinguishable) → `COUPON_NOT_STARTED` → `COUPON_EXPIRED` → `COUPON_TIER_INELIGIBLE` → `COUPON_MIN_ORDER_NOT_MET` (vs cart subtotal; error payload carries `details: { minOrderTotal }`) → `COUPON_NOT_APPLICABLE` (scoped base = 0) → `COUPON_USAGE_LIMIT_REACHED` → `COUPON_CUSTOMER_LIMIT_REACHED`. Discount math: `percentage` → `floor(base × value/100)`; `fixed_amount` → `value`; then `min(discount, maxDiscountAmount ?? ∞, base)` where `base` is the sum of scope-matching lines (empty scope = whole subtotal). Usage limits count `applied` redemptions only; a pre-shipment cancellation flips the redemption to `released` and frees the limits. One coupon per order (unique `orderId` on redemptions); no stacking, no auto-apply.
- `GET /orders` - List current customer's orders newest first. Query `page`, `limit`. Items are `{ id, orderNo, orderStatus, paymentStatus, paymentMethod, grandTotal, itemCount, createdAt }`.
- `GET /orders/:orderNo` - Get current customer's order detail: `items[]`, `totals`, the immutable `shipping` snapshot, and the status `timeline[]`. `404` for foreign or unknown order numbers.

## Wishlist

Customer role only. Every customer has one persistent wishlist keyed by a unique `(userId, productId)` index — all routes are scoped to the caller and there is no way to address another customer's list. The wishlist stores **no** product snapshot: entries resolve live `name`, `image`, `price`, `salePrice`, `effectivePrice`, `availableStock`, `inStock`, `slug`/`sku` at read time. Products that become inactive or soft-deleted disappear from the response while the row is retained — they reappear automatically when reactivated.

- `GET /wishlist` - List the caller's wishlist newest first: `{ data: WishlistItem[] }` where each item is `{ id, addedAt, product }` and `product` is the live shape above.
- `POST /wishlist/items` - Add a product. Body `{ productId }`; re-adding is a safe no-op (upsert on insert only). Returns `{ data: WishlistItem[] }`. `404` for malformed ids; `400 PRODUCT_UNAVAILABLE` for unknown or deleted products.
- `DELETE /wishlist/items/:productId` - Remove a product; returns `{ data: WishlistItem[] }`. `404` when the product is not in the caller's wishlist.
- `POST /wishlist/items/:productId/move-to-cart` - Move an item to the Epic 3 cart via the shared `addCartItem` (qty 1, all stock/availability rules apply unchanged). On success the wishlist row is removed and `{ data: { wishlist, cart } }` is returned; on failure (`PRODUCT_UNAVAILABLE`, `INSUFFICIENT_STOCK`, …) the row is preserved and the domain error propagates. `404` when the product is not in the caller's wishlist.

## Product Reviews

Reviews carry `{ id, productId, rating (int 1-5), comment, status: pending | approved | rejected, authorName, createdAt, updatedAt }`. New reviews always start `pending` and are never publicly visible until staff approval. One review per customer per product is enforced by a unique `(userId, productId)` index (`409 REVIEW_EXISTS`). Eligibility is purchase-gated: the customer must own a non-`cancelled` order containing the product (`403 REVIEW_NOT_ELIGIBLE`); `delivered` is not required. `ratingAverage`/`ratingCount` on product list/detail are recomputed server-side from **approved** reviews only after every change to the approved set.

- `GET /products/:productId/reviews` - Public list of **approved** reviews, newest first. Query `page`, `limit`. Returns `{ data: Review[], meta }`.
- `POST /products/:productId/reviews` - Create the caller's review. Customer only. Body `{ rating: 1-5 int, comment? (max 2000) }`; returns `201 { data: review }` with `status=pending`. Errors: `403 REVIEW_NOT_ELIGIBLE`, `409 REVIEW_EXISTS`, `404` for unknown/inactive/deleted products.
- `GET /products/:productId/reviews/me` - `{ data: { review: Review | null, eligible: boolean } }` — the caller's own review in any status plus current purchase eligibility. Customer only.
- `PATCH /reviews/:id` - Edit the caller's own review. Body `{ rating?, comment? }`; a real content change returns the review to `pending` (re-moderation) and recomputes the product aggregate when it was approved. `404` for foreign or unknown ids — other customers' reviews are indistinguishable from missing ones.
- `DELETE /reviews/:id` - Delete the caller's own review; recomputes the aggregate when it was approved. Returns `{ data: { ok: true } }`; `404` as above.

## Staff Review Moderation

The identical moderation handlers are mounted under `/employee/reviews` (employee role) and `/admin/reviews` (admin role) — same list, status transitions, delete semantics, and audit actions; only the actor role differs. Staff items add `customer { id, fullName, email }` and `product { id, name, slug }` to the public shape.

- `GET /<area>/reviews` - Moderation queue, newest first. Query `page`, `limit`, `status` = `pending | approved | rejected | all` (default `pending`).
- `PATCH /<area>/reviews/:id/status` - Approve or reject. Body `{ status: approved | rejected, reason? | note? }`; re-setting the current status is a no-op. Every real transition writes a `review.status_change` audit entry (`previousValue`/`nextValue` carry `status`) and recomputes the product's approved-only aggregate.
- `DELETE /<area>/reviews/:id` - Permanently delete a review; writes a `review.delete` audit entry snapshotting the review and recomputes the aggregate when it was approved. Returns `{ data: { ok: true } }`.

## Storefront Banners

- `GET /banners` - Public feed of banners where `isActive`, not soft-deleted, and `now` is inside the `[startAt, endAt]` window (either bound may be omitted for open-ended). Sorted by `displayOrder` then creation order. Returns `{ data: [{ id, imageUrl, imageAlt, title, subtitle, linkUrl }] }` — no auth required.

## Admin Banners

Admin role only; employees and customers receive `403`. All mutations write `banner.create`/`banner.update`/`banner.status_change`/`banner.delete` audit entries; failed operations write none. Requests are `multipart/form-data`: text fields plus an optional file field `image` (≤5MB, JPEG/PNG/WebP/GIF, stored under `/uploads/banners`; the DB keeps URL metadata only).

- `GET /admin/banners` - List banners by `displayOrder`. Query `page`, `limit`, `status` = `all | active | inactive | deleted` (default `all`; soft-deleted rows only appear under `status=deleted`). Items are the public shape plus `displayOrder`, `startAt`, `endAt`, `isActive`, `isDeleted`, `createdAt`.
- `POST /admin/banners` - Create a banner. Fields `{ title?, subtitle?, imageAlt?, linkUrl?, displayOrder? (int ≥0), startAt?, endAt?, isActive? }` — dates are ISO 8601, empty means open-ended, `isActive` defaults to true; `image` is required. Returns `201 { data: banner }`. Errors: `400 INVALID_IMAGE_COUNT`, `400 UNSUPPORTED_FILE_TYPE`, `400 FILE_TOO_LARGE`, `400` when `startAt > endAt`.
- `PATCH /admin/banners/:id` - Update any subset of the create fields; a new `image` file replaces the stored one and removes the old file. Returns `{ data: banner }`; `409 BANNER_DELETED` on soft-deleted rows.
- `DELETE /admin/banners/:id` - Soft delete (sets `isDeleted` and `isActive=false`); returns `{ data: banner }`. `409 BANNER_DELETED` when already deleted.

## Employee Orders

Employee role only.

- `GET /employee/orders` - List all orders for fulfillment, newest first. Query `page`, `limit`, `status` (any order status). List items add `customerName` (the shipping recipient).
- `GET /employee/orders/:orderNo` - Get order detail for fulfillment; adds `customer { id, fullName, email, phone }` (the account behind the order), `notesInternal`, and `inventoryState` (`reserved | deducted | released`).
- `PATCH /employee/orders/:orderNo/status` - Update order status using the shared state machine (see Conventions). Body `{ status, reason? | note? }`. Shipping consumes the reservation (`inventoryState -> deducted`); cancelling releases it (`-> released`). Errors: `400 INVALID_STATUS_TRANSITION` (`details` carry `fromStatus`/`toStatus`), `409 ORDER_STATE_CHANGED` when a concurrent update wins. Writes an `order.status_change` audit log.
- `PATCH /employee/orders/:orderNo/payment` - Manually set payment status. Body `{ paymentStatus: unpaid | paid, reason? | note? }`; `unpaid -> paid` sets `paidAt`, `paid -> unpaid` clears `paidAt`, and re-setting the current value is a no-op. Every real change writes an `order.payment_status_change` audit log; `409 ORDER_STATE_CHANGED` on a lost race.

## Admin Dashboard

Admin role only.

- `GET /admin/dashboard` - `{ data: { generatedAt, orders: { today, thisWeek, byStatus }, revenue: { today, thisWeek }, lowStockProducts[] } }`. Boundaries are server-local: today starts 00:00 local and the week starts the most recent Monday 00:00. Revenue is `SUM(totals.grandTotal)` over `paymentStatus=paid` and `orderStatus != cancelled`, grouped by `paidAt`. `lowStockProducts` are active products where `availableStock <= lowStockThreshold`, max 20, each `{ id, name, sku, stockOnHand, stockReserved, availableStock, lowStockThreshold }`.
- `GET /admin/audit-logs` - List audit logs newest first. Query `page`, `limit`, `actorId` (must be a valid ObjectId), `entityType`, `entityId`, `action`. Entries are `{ id, actor { userId, role, label }, action, entityType, entityId, previousValue, nextValue, note, createdAt }`.

## Admin Catalog

Admin role only; list routes include inactive and soft-deleted records.

- `GET /admin/products` - List products. Query `page`, `limit`, `q` (name, sku, slug), `status` = `all | active | inactive | deleted`.
- `GET /admin/products/:id` - Get one product including `isActive`, `isDeleted`, `stockOnHand`/`stockReserved`/`availableStock`, `lowStockThreshold`, `soldCount`, and rating fields.
- `POST /admin/products` - Create product. Body `{ name, slug?, sku, shortDescription?, description?, ingredients?, benefits?[], usageInstructions?, volume?, skinTypes?[], price, salePrice?, stockOnHand?, lowStockThreshold?, category, brand, isActive? }` where `category`/`brand` are ObjectIds; `slug` defaults to a slugified `name` and `sku` is uppercased. Returns `201 { data: product }`. Errors: `409 SLUG_TAKEN`, `409 SKU_TAKEN`, `400 INVALID_CATEGORY`, `400 INVALID_BRAND`.
- `PATCH /admin/products/:id` - Update product; same fields, all optional. The slug only changes when `slug` is explicitly sent — renaming a product never silently changes its storefront URL. `409 PRODUCT_DELETED` when the product was soft-deleted, plus the uniqueness/reference errors above.
- `DELETE /admin/products/:id` - Soft delete: sets `isDeleted` and `isActive=false` and releases the slug/sku namespace with a `--del-<timestamp>` suffix so a replacement can reuse them. Returns `{ data: product }`; `409 PRODUCT_DELETED` when already deleted.
- `POST /admin/products/:id/images` - Upload product images. `multipart/form-data` with file field `images` (1-6 files per request, ≤5MB each, JPEG/PNG/WebP/GIF) and optional text field `alt` applied to every file. Files are written under `/uploads/products`; the DB stores `{ url, alt, isPrimary }` metadata only, and the first image on a product becomes primary. Errors: `400 UNSUPPORTED_FILE_TYPE`, `400 FILE_TOO_LARGE`, `400 INVALID_IMAGE_COUNT`, `400 IMAGE_LIMIT_EXCEEDED` (existing + new files would exceed 6), `409 PRODUCT_DELETED`.
- `PATCH /admin/products/:id/images/:imageId` - Replace one product image. `multipart/form-data` with file field `image`; writes a new file, updates the stored URL, and removes the old file. `404` when `:imageId` is not a stored filename on the product.
- `DELETE /admin/products/:id/images/:imageId` - Delete one product image file and its metadata; promotes the next image to primary when the removed one was primary. `404` for an unknown `:imageId`.
- `GET /admin/categories` - List all categories including inactive/deleted; the DTO adds `isActive` and `isDeleted`.
- `POST /admin/categories` - Create category. Body `{ name, slug?, description?, displayOrder?, isActive?, imageUrl? }`; `201`. `409 SLUG_TAKEN`.
- `PATCH /admin/categories/:id` - Update category; same fields, all optional. `409 ALREADY_DELETED`, `409 SLUG_TAKEN`.
- `DELETE /admin/categories/:id` - Soft delete releasing the slug; returns `{ data: { ok: true } }`. `409 CATEGORY_IN_USE` (with `details.products` = referencing count) when live products reference it; `409 ALREADY_DELETED`.
- `GET /admin/brands` - List all brands including inactive/deleted; the DTO adds `displayOrder`, `isActive`, `isDeleted`.
- `POST /admin/brands` - Create brand; body as categories plus `logoUrl?` and `country?` instead of `imageUrl`. `201`; `409 SLUG_TAKEN`.
- `PATCH /admin/brands/:id` - Update brand; same rules. `409 ALREADY_DELETED`, `409 SLUG_TAKEN`.
- `DELETE /admin/brands/:id` - Soft delete releasing the slug; `{ data: { ok: true } }`. `409 BRAND_IN_USE` when live products reference it; `409 ALREADY_DELETED`.

## Admin Orders And Payments

Admin role only. These are the identical Epic 4 handlers mounted a second time under `/admin/orders` — same request bodies, transition table, inventory side effects, and audit actions as the employee routes; only the actor role differs.

- `GET /admin/orders` - List all orders. Query `page`, `limit`, `status`.
- `GET /admin/orders/:orderNo` - Get any order detail (staff shape: `customer`, `notesInternal`, `inventoryState`).
- `PATCH /admin/orders/:orderNo/status` - Update order status using the shared state machine. Body `{ status, reason? | note? }`. Errors: `400 INVALID_STATUS_TRANSITION`, `409 ORDER_STATE_CHANGED`.
- `PATCH /admin/orders/:orderNo/payment` - Manually set payment status. Body `{ paymentStatus: unpaid | paid, reason? | note? }`; `unpaid -> paid` sets `paidAt`, `paid -> unpaid` clears `paidAt`, and every real change writes an audit log. `409 ORDER_STATE_CHANGED` on a lost race.

## Admin Customers And Staff

Admin role only.

- `GET /admin/customers` - List customers. Query `page`, `limit`, `q` (matches fullName, email, phone), `status` = `active | blocked | inactive`. Items are `{ id, email, fullName, phone, status, createdAt, lastLoginAt }`.
- `GET /admin/customers/:id` - Get customer profile and order summary: `{ data: { customer, orders } }` where `orders` are the customer's order list items newest first. `400` for a malformed id; `404` when the user does not exist or is not a customer.
- `PATCH /admin/customers/:id/status` - Block or unblock a customer. Body `{ status: active | blocked, note? }`; setting the current status is a no-op, real changes write a `customer.status_change` audit log. Blocking takes effect immediately: login returns `403` and protected API calls return `401`.
- `GET /admin/staff` - List all users holding the `admin` or `employee` role, oldest first; returns `{ data: AdminStaff[] }` (not paginated) where each item adds `roles` to the customer shape.
- `POST /admin/staff` - Create a staff member. Body `{ email, password (8-128 chars), fullName, phone?, role: admin | employee }`; returns `201 { data: staff }`. `409 EMAIL_TAKEN`.
- `PATCH /admin/staff/:id/role` - Set staff role. Body `{ role: admin | employee, note? }`; no-op when unchanged, otherwise writes a `staff.role_change` audit log. `409 CANNOT_CHANGE_OWN_ROLE`.
- `PATCH /admin/staff/:id/status` - Activate or deactivate staff. Body `{ status: active | inactive, note? }`; writes a `staff.status_change` audit log. `409 CANNOT_DEACTIVATE_SELF` — an admin cannot deactivate their own account.

## Admin Promotions And Coupons

Admin role only; employees and customers receive `403`. All mutations write `promotion.create`/`promotion.update`/`promotion.status_change`/`promotion.delete` and `coupon.*` audit entries; failed operations write none. All deletes are soft deletes.

- `GET /admin/promotions` - List promotions newest first. Query `page`, `limit`, `status` = `all | active | inactive | deleted` (default `all`; soft-deleted rows only under `status=deleted`). Items: `{ id, name, discountType, discountValue, maxDiscountAmount, startAt, endAt, minOrderTotal, productIds[], categoryIds[], brandIds[], tierCodes[], isActive, isDeleted, createdAt }`.
- `POST /admin/promotions` - Create a promotion. Body `{ name, discountType: percentage | fixed_amount, discountValue, maxDiscountAmount?, startAt?, endAt?, minOrderTotal?, productIds?[], categoryIds?[], brandIds?[], tierCodes?[], isActive? }` — dates ISO 8601, empty/null means open-ended; `tierCodes` empty means all tiers; scope arrays empty means the discount base is the whole subtotal. `201`; `400` when `startAt > endAt`.
- `PATCH /admin/promotions/:id` - Update any subset of the create fields. `409 PROMOTION_DELETED` on soft-deleted rows.
- `DELETE /admin/promotions/:id` - Soft delete (`isDeleted`, `isActive=false`); its coupons immediately fail customer validation as `COUPON_INACTIVE`. `409 PROMOTION_DELETED` when already deleted.
- `GET /admin/coupons` - List coupons newest first. Query `page`, `limit`, `status` (as promotions), `promotionId`. Items add `promotionName` and `usageCount` (count of `applied` redemptions).
- `POST /admin/coupons` - Create a coupon. Body `{ code (≤50, normalized uppercase), promotionId, usageLimitTotal?, usageLimitPerCustomer?, isActive? }` — `null` limits mean unlimited. `201`; `400 INVALID_PROMOTION` for a missing/deleted promotion; `409 COUPON_CODE_TAKEN` when the code exists in any case.
- `PATCH /admin/coupons/:id` - Update any subset of the create fields; `code` changes re-check uniqueness. `409 COUPON_DELETED`, `409 COUPON_CODE_TAKEN`.
- `DELETE /admin/coupons/:id` - Soft delete and release the code with a `--del-<ts>` suffix so it can be recreated; historical orders still resolve via `totals.couponRef`. `409 COUPON_DELETED` when already deleted.
- `GET /admin/coupons/:id/redemptions` - Paginated redemption history for the coupon, newest first: `{ id, couponId, promotionId, orderId, orderNo, userId, code, discountAmount, status: applied | released, releasedAt, createdAt }`.
