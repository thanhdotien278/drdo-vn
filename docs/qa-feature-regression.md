# DrDo.vn MVP Feature Regression Checklist

Use this checklist to verify the MVP against `requirements.md`, `api-spec.md`, and `erd.md`.

## Test Conventions

- Result values: `Pass`, `Fail`, `Partial`, `Missing`, `Blocked`.
- Default API URL for local checks: `http://localhost:4005`.
- Default web URL for local checks: `http://localhost:5173`.
- Use seeded admin, employee, and customer accounts (`npm run seed`).
- `npm run smoke` walks the whole commerce loop against seeded data and asserts the inventory and RBAC invariants; run it before working through the manual rows.

## Baseline Checks

| Area | Check | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| Build | `npm run build` | Completes without errors |  |  |
| Lint | `npm run lint` | Completes without errors |  |  |
| API | Health check | API starts and `/health` returns 200 |  |  |
| Web | Main pages | Web starts and storefront renders |  |  |
| Mobile storefront | Product list, product detail, cart, and checkout remain usable on mobile viewport |  |  |
| Basic accessibility | Primary controls are keyboard reachable, focus is visible, contrast is readable, and form inputs have labels |  |  |
| Protected states | Protected screens handle loading, anonymous, unauthorized, empty-data, and API-error states |  |  |
| Seed data | MVP seeds | Two customers, employee, admin, categories, brands, active products, one low-stock product, one inactive product, unpaid sample orders, four membership tiers, loyalty ledger entries, coupons covering every rejection reason, banners in three window states, wishlist items, and reviews in both moderation states exist |  |  |
| Seed idempotency | `npm run seed` twice | Second run reports identical counts |  |  |
| API smoke | `npm run smoke` | All checks report `ok` |  |  |

## 1. Authentication And RBAC

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Customer registration | New customer is created with `customer` role |  |  |
| Customer login | Login returns token/session and `GET /auth/me` returns customer profile |  |  |
| Employee login | Login returns token/session and `GET /auth/me` returns employee role |  |  |
| Admin login | Login returns token/session and `GET /auth/me` returns admin role |  |  |
| Anonymous protected access | Cart, account, admin, and employee APIs return `401` |  |  |
| Customer RBAC | Customer receives `403` for employee/admin APIs |  |  |
| Employee RBAC | Employee can access employee order/status/payment APIs and receives `403` for admin APIs |  |  |
| Admin RBAC | Admin can access admin dashboard, catalog, order, customer, staff, and audit APIs |  |  |
| Blocked user | Blocked account cannot login or call protected APIs |  |  |

## 2. Product Browsing

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Home | Product and category sections render from API data |  |  |
| Product list | Products load with pagination |  |  |
| Search | Keyword search filters products |  |  |
| Category filter | Category slug filters products |  |  |
| Brand filter | Brand slug filters products |  |  |
| Price filter | Min/max price filters products |  |  |
| Availability filter | In-stock filter excludes unavailable products |  |  |
| Sorting | Newest, price ascending, price descending, and popularity sort return deterministic ordering |  |  |
| Product detail | Images, name, price, description, ingredients, benefits, usage, and stock state render for active product |  |  |
| Missing product | Unknown slug returns 404 and the page renders a non-broken not-found state |  |  |
| Inactive product | Inactive product is hidden from normal storefront list/detail |  |  |
| Out of stock | Out-of-stock product cannot be checked out |  |  |

## 3. Cart

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Add item | Product is added to customer cart |  |  |
| Add duplicate | Duplicate add updates quantity on existing cart item |  |  |
| Update quantity | Quantity changes and totals recalculate |  |  |
| Remove item | Item is removed and totals recalculate |  |  |
| Totals | Subtotal uses cart price snapshot |  |  |
| Inactive product | API rejects inactive product |  |  |
| Quantity above stock | Add/update rejects quantity above available stock |  |  |

## 4. Customer Addresses

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Address list | Customer can list only their own saved shipping addresses |  |  |
| Create address | Customer can create a saved shipping address without postal code |  |  |
| Edit address | Customer can edit only their own saved shipping address |  |  |
| Delete address | Customer can delete only their own saved shipping address |  |  |
| Default address | Customer can set one default saved shipping address |  |  |
| Address RBAC | Employee, Admin, and other customers cannot mutate a customer's saved address |  |  |

## 5. Checkout, Orders, And Inventory

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Empty checkout | Checkout with empty cart is rejected |  |  |
| Customer checkout | Valid cart creates an order from saved address or inline shipping/contact fields |  |  |
| Shipping snapshot | Order stores immutable shipping/contact snapshot fields without postal code |  |  |
| Address mutation isolation | Editing or deleting a saved address does not change an existing order snapshot |  |  |
| Initial order status | New order has `orderStatus=pending` |  |  |
| Initial payment status | New order has `paymentStatus=unpaid` |  |  |
| Payment method | Order accepts `cod`, `bank_transfer`, or `momo_manual` |  |  |
| Cart cleanup | Cart is cleared after order creation |  |  |
| Stock reservation | Checkout reserves stock and does not deduct `stockOnHand` |  |  |
| No auto payment | Checkout never marks payment as `paid` |  |  |
| Customer order ownership | Customer can see only their own orders |  |  |
| Customer cannot mutate status | Customer cannot update order or payment status |  |  |

## 6. Employee Order And Manual Payment Management

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| List orders | Employee can view order list |  |  |
| Filter by status | Employee can filter orders by status |  |  |
| Order detail | Employee can view order detail and customer support information |  |  |
| `pending -> processing` | Transition succeeds |  |  |
| `processing -> shipped` | Transition succeeds, consumes reservation, and deducts stock on hand once |  |  |
| `shipped -> delivered` | Transition succeeds |  |  |
| Cancel before shipped | `pending/processing -> cancelled` succeeds and releases reserved stock |  |  |
| Cancel after shipped | `shipped -> cancelled` is rejected |  |  |
| Revert status | Backward transition is rejected |  |  |
| Final status | Delivered/cancelled orders cannot be changed |  |  |
| Invalid status | Unknown status is rejected |  |  |
| Employee mark paid | Employee can set `paymentStatus=paid` with optional note |  |  |
| Employee mark unpaid | Employee can set `paymentStatus=unpaid` with optional note |  |  |
| Employee payment audit | Manual payment change writes audit log |  |  |

## 7. Admin Order And Manual Payment Management

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| List all orders | Admin can view all orders |  |  |
| Order detail | Admin can view any order detail |  |  |
| Update order status | Admin follows same status rules as employee |  |  |
| Admin mark paid | Admin can set `paymentStatus=paid` with optional note |  |  |
| Admin mark unpaid | Admin can set `paymentStatus=unpaid` with optional note |  |  |
| Admin payment audit | Manual payment change writes audit log |  |  |

## 8. Admin Product, Category, Brand

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Create product | Admin can create product with valid fields |  |  |
| Edit product | Admin can update product details, price, stock, images, category, brand, and status |  |  |
| Soft delete product | Admin can soft delete product |  |  |
| Product validation | Missing required fields are rejected |  |  |
| Numeric validation | Negative price and stock are rejected |  |  |
| Image upload | Admin can upload 1-6 product images and files are stored under `/uploads/products` |  |  |
| Image replace | Admin can replace a product image and product metadata points to the replacement URL/path |  |  |
| Image delete | Admin can delete a product image and product metadata no longer includes that URL/path |  |  |
| Image metadata | Product stores image URL/path metadata only |  |  |
| Storefront images | Public product list/detail render image URLs from product data |  |  |
| Create category | Admin can create category |  |  |
| Edit category | Admin can update category |  |  |
| Delete category | Category delete is blocked when products reference it |  |  |
| Create brand | Admin can create brand |  |  |
| Edit brand | Admin can update brand |  |  |
| Delete brand | Brand delete is blocked when products reference it |  |  |
| Shop reflection | Active admin product/category/brand changes appear in storefront browsing |  |  |
| Catalog audit | Product/category/brand mutations write audit logs |  |  |

## 9. Customer Account

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Profile view | Customer profile loads |  |  |
| Profile edit | Customer can edit supported profile fields |  |  |
| Saved addresses | Customer saved address list and default address render |  |  |
| Order history | Latest order appears first |  |  |
| Order detail | Timeline, item snapshot, totals, payment method, payment status, shipping/contact snapshot, and order status render |  |  |

## 10. Reports, Customers, Staff, Audit

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Admin dashboard | Summary stats render with seeded data |  |  |
| Revenue summary | Revenue sums `grandTotal` for orders with `paymentStatus=paid` and `orderStatus != cancelled` |  |  |
| Revenue date | Revenue today/week uses `paidAt`, not order creation date |  |  |
| Mark paid timestamp | `unpaid -> paid` sets `paidAt` |  |  |
| Payment correction | `paid -> unpaid` clears `paidAt` and writes audit log |  |  |
| Low-stock report | Low-stock products list renders |  |  |
| Customer list | Admin can view customers |  |  |
| Customer detail | Admin can view one customer's profile and orders |  |  |
| Customer status | Admin can block/unblock customers |  |  |
| Customer audit | Customer status changes write audit logs |  |  |
| Staff list | Admin can view staff |  |  |
| Create staff | Admin can create staff account |  |  |
| Staff login | New staff can login with expected role |  |  |
| Staff role update | Admin can update staff role to `admin` or `employee` |  |  |
| Staff status | Admin can activate/deactivate staff except own active account |  |  |
| Staff audit | Staff role/status changes write audit logs |  |  |
| Audit list | Admin can list audit logs |  |  |

## 11. Wishlist

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Add to wishlist | Authenticated customer can add a product |  |  |
| Duplicate add | Adding a product already saved is a no-op, not an error |  |  |
| List wishlist | Entries show current price, sale price, and stock state |  |  |
| Remove from wishlist | Item is removed |  |  |
| Move to cart | Item is added to the cart and removed from the wishlist |  |  |
| Move to cart failure | A rejected cart add leaves the wishlist row intact |  |  |
| Inactive product | Inactive or deleted products are hidden from browsing without breaking the list |  |  |
| Row survives | Reactivating a product makes it reappear — the row was hidden, not deleted |  |  |
| Wishlist RBAC | Anonymous gets 401; employee and admin get 403 |  |  |
| Cross-customer isolation | One customer never sees another's wishlist |  |  |

## 12. Reviews And Moderation

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Purchase gate | Only a customer with a non-cancelled order containing the product may review it |  |  |
| One per product | A second review for the same product is rejected |  |  |
| Rating bounds | Rating must be 1-5 |  |  |
| Starts pending | A new review is `pending` and absent from the public list |  |  |
| Approve | Admin or employee approval makes the review publicly visible |  |  |
| Reject | Rejection keeps it hidden |  |  |
| Own edit/delete | A customer can edit or delete only their own review |  |  |
| Edit resets moderation | Editing an approved review returns it to `pending` |  |  |
| Staff delete | Admin and employee can delete any review |  |  |
| Rating aggregate | Product list and detail show average rating and count from **approved reviews only** |  |  |
| Aggregate recompute | Approving, rejecting, editing, or deleting recomputes the product rating |  |  |
| Popularity sort | Catalog `sort=popularity` still returns a stable order after reviews exist |  |  |
| Moderation audit | Every moderation action writes an audit log |  |  |

## 13. Storefront Banners

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Create banner | Admin can create a banner with image, optional title/subtitle/link, order, and date range |  |  |
| Banner image upload | Image is stored under `/uploads/banners`; only the URL/path is stored in MongoDB |  |  |
| Edit banner | Admin can edit banner fields |  |  |
| Reorder | Admin can change display order and the storefront reflects it |  |  |
| Activate/deactivate | Inactive banners are not rendered |  |  |
| Soft delete | Deleted banners disappear from the storefront and from the default admin list |  |  |
| Active window | A banner outside its start/end window is not rendered |  |  |
| Display order | The storefront renders active in-window banners in display order |  |  |
| Empty state | With no active banners the home page renders normally, with no empty box |  |  |
| Banner RBAC | Customer and employee get 403 on every admin banner route |  |  |
| Banner audit | Banner create/edit/delete writes audit logs |  |  |

## 14. Loyalty, Memberships, And Coupons

### 14.1 Membership tiers

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Seeded tiers | Đồng/Bạc/Vàng/Bạch Kim exist with the exact PRD thresholds, multipliers, and free-shipping values |  |  |
| Tri-state free shipping | Đồng has no benefit (`null`), Bạch Kim is always free (`0`) — the two behave differently |  |  |
| Tier from lifetime points | Tier is determined by lifetime earned points, resolved at read time |  |  |
| Admin tier config | Admin can edit thresholds/multipliers; changes take effect immediately |  |  |
| No tier delete | There is no delete route; deactivation is the only removal |  |  |

### 14.2 Accrual

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Accrual trigger | Points accrue when an order reaches `shipped` |  |  |
| No early accrual | No points at `pending`, `processing`, or `cancelled` |  |  |
| Accrual once | Replaying `shipped` never awards a second time |  |  |
| Earn base | Base excludes shipping and is post-discount and post-redemption |  |  |
| Base points | `floor(earnBase / 1000)` |  |  |
| Tier multiplier | `floor(basePoints × tierEarnMultiplier)` using the tier at the moment of shipment |  |  |
| Zero-point order | A cheap order still writes a ledger row, so "accrued" is recorded |  |  |
| Tier recalculated | Tier is recalculated immediately after accrual and recorded on the ledger row |  |  |
| Tier never lowers | Redemption never lowers a tier |  |  |

### 14.3 Redemption

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Redeem rate | 10đ per point |  |  |
| Redeem step | Non-multiples of 100 are rejected |  |  |
| Balance bound | Redeeming more than the balance is rejected |  |  |
| 20% cap | Redemption above 20% of the cart subtotal is rejected |  |  |
| Rejected not reduced | An out-of-bounds redemption is rejected outright, never silently reduced |  |  |
| Deducted at creation | Redeemed points are deducted when the order is created |  |  |
| Not auto-returned | Cancelling before shipping does **not** return the points |  |  |
| No overdraw | Concurrent redemptions cannot drive the balance below zero |  |  |

### 14.4 Balances and history

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Derived balance | Balance and lifetime totals are computed from the ledger, not a stored counter |  |  |
| Customer view | Customer sees balance, tier, progress to next tier, and point history |  |  |
| Admin adjustment | Admin can adjust points with a **required** reason |  |  |
| Adjustment audit | Manual adjustments are audit-logged |  |  |
| Employee blocked | Employee gets 403 on the adjustment route |  |  |

### 14.5 Coupons

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Case-insensitive code | `drdo10` and `DRDO10` resolve to the same coupon |  |  |
| Unknown code | Distinct error `COUPON_NOT_FOUND` |  |  |
| Inactive / soft-deleted | Distinct error `COUPON_INACTIVE`; the two are indistinguishable to the customer |  |  |
| Not started | Distinct error `COUPON_NOT_STARTED` |  |  |
| Expired | Distinct error `COUPON_EXPIRED` |  |  |
| Total limit reached | Distinct error `COUPON_USAGE_LIMIT_REACHED` |  |  |
| Per-customer limit | Distinct error `COUPON_CUSTOMER_LIMIT_REACHED` |  |  |
| Tier ineligible | Distinct error `COUPON_TIER_INELIGIBLE` |  |  |
| Minimum order not met | Distinct error `COUPON_MIN_ORDER_NOT_MET` |  |  |
| Cart ineligible | Distinct error `COUPON_NOT_APPLICABLE` |  |  |
| Percentage and cap | Percentage discount honours `maxDiscountAmount` |  |  |
| Scope is the discount base | "20% off brand X" on a cart with one 300,000đ brand-X line and one 2,000,000đ other line discounts 60,000đ, not 460,000đ |  |  |
| One coupon per order | A second coupon on the same order is rejected |  |  |
| Redemption recorded | Applying a coupon records a redemption tied to the order and customer |  |  |
| Release on cancel | Cancelling the order releases the redemption and frees the usage limit |  |  |
| Historical resolution | A soft-deleted or disabled coupon still resolves from an order that redeemed it |  |  |
| Immutable snapshot | Editing the promotion afterwards does not change the historical order |  |  |
| Admin usage view | Admin can view usage counts and redemptions |  |  |
| Employee read-only | Employee can view a coupon in order context but has no write route; every `/admin/coupons*` route returns 403 |  |  |

### 14.6 Order totals

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Server-computed | Totals are computed server-side; client-supplied totals are ignored |  |  |
| All seven stored | Every order stores all seven fields even when zero |  |  |
| Never negative | `grandTotal` is clamped at 0 |  |  |
| Arithmetic | `grandTotal = subtotal − discountAmount − pointsDiscountAmount + shippingFee` |  |  |
| Preview matches order | The checkout preview and the resulting order agree |  |  |
| Free shipping base | The tier threshold is measured after the coupon and **before** point redemption |  |  |

## Final Report Template

| Feature Area | Result | Bugs / Gaps | Evidence |
| --- | --- | --- | --- |
| Authentication & RBAC |  |  |  |
| Product Browsing |  |  |  |
| Cart |  |  |  |
| Customer Addresses |  |  |  |
| Checkout, Orders & Inventory |  |  |  |
| Employee Order & Payment Management |  |  |  |
| Admin Order & Payment Management |  |  |  |
| Admin Catalog Management |  |  |  |
| Customer Account |  |  |  |
| Reports, Customers, Staff & Audit |  |  |  |
| Wishlist |  |  |  |
| Reviews & Moderation |  |  |  |
| Storefront Banners |  |  |  |
| Loyalty & Memberships |  |  |  |
| Promotions & Coupons |  |  |  |

Record Phase 2 separately: MoMo gateway, bank gateway, IPN/callback, automatic payment verification, returns/refunds/reversal after shipment, advanced analytics, exports, notifications, and settings. Promotions/coupons, wishlist, reviews, banners, loyalty, and memberships are **MVP** as of 2026-07-26 and are covered by sections 11-14 above.
