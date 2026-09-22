# DrDo.vn Project Description

## One-Line Description

DrDo.vn is a Vietnamese beauty and skincare e-commerce website with a public storefront, customer checkout, and admin/employee operations dashboard.

## What The Rebuild Should Preserve

- The business domain: Vietnamese skincare and beauty products.
- The core roles: customer, employee, admin.
- The main commerce loop: browse product -> add to cart -> checkout -> order tracking.
- The operations loop: admin/employee login -> manage/process orders -> update inventory/payment/customer state.
- The product data richness: Vietnamese categories, VND pricing, product images, ingredients, benefits, and usage instructions.
- The conservative payment rule: checkout creates an unpaid order, and only Admin or Employee manual confirmation can mark it paid.

## What The Rebuild Should Avoid

- Do not copy old code structure automatically.
- Do not implement Phase 2 features before the MVP is stable.
- Do not make frontend authorization the only protection.
- Do not mark MoMo-manual or bank-transfer orders as paid without Admin or Employee manual confirmation.
- Do not build product variants, native apps, marketplace seller tools, or complex analytics unless explicitly requested.

## Primary User Journeys

### Customer Purchase Journey

1. Customer opens the storefront.
2. Customer browses or searches products.
3. Customer filters by category, brand, price, or popularity.
4. Customer opens product detail and reviews product information.
5. Customer adds product to cart.
6. Customer updates cart quantity if needed.
7. Customer chooses a saved shipping address or enters shipping/contact information.
8. Customer selects COD, MoMo manual, or bank transfer.
9. System creates an unpaid order with an immutable shipping/contact snapshot.
10. Customer views order status and payment status.

### Employee Order Journey

1. Employee logs in.
2. Employee opens employee dashboard.
3. Employee views pending/processing orders.
4. Employee opens order detail.
5. Employee advances status through the allowed workflow.
6. System records audit log and inventory effects.

### Admin Operations Journey

1. Admin logs in.
2. Admin reviews dashboard metrics and low-stock list.
3. Admin manages products, categories, and brands.
4. Admin views all orders and can update status/payment.
5. Admin manages customers and staff accounts.
6. System records audit logs for sensitive changes.

## MVP Feature Map

| Area | MVP Need |
| --- | --- |
| Storefront | Home, product list, product detail, search/filter/sort |
| Auth | Register, login, current user, logout/block handling |
| Cart | Persistent cart, add/update/remove, totals |
| Addresses | Customer-owned saved shipping addresses, default address, no postal code |
| Checkout | Saved address or inline shipping/contact form, immutable order snapshot, order creation, cart cleanup |
| Orders | Customer order list/detail, staff/admin order management |
| Inventory | Reserve on checkout, deduct on shipped, release/restore on cancel |
| Admin | Dashboard metrics, product/category/brand CRUD, customer/staff/order/payment management |
| Employee | Order list/detail/status update only |
| Promotions | Phase 1: coupon codes, discount rules, server-side validation, Admin-only management |
| Wishlist | Phase 1: one persistent wishlist per customer, movable into the cart |
| Reviews | Phase 1: purchase-gated, one per product, moderated before public display |
| Banners | Phase 1: Admin-managed home banners with a scheduled active window |
| Loyalty | Phase 1: points accrued at shipment, ledger-derived balances, four membership tiers |
| Payments | Manual-only MVP using `cod`, `bank_transfer`, and `momo_manual`; no gateway integration |
| Audit | Required for operational changes |

## Phase Guidance

### Phase 1: Clean MVP

Build storefront, auth, cart, customer address book, checkout, order management, basic admin/employee dashboards, RBAC, inventory rules, and audit logs.

### Phase 2: Growth Features

Add advanced reports, dashboard charts, export, notifications, site settings, stock history, returns/refunds, 2FA, and real payment gateway workflows.

### Phase 3: Optimization

Improve performance, SEO, mobile polish, PWA behavior, analytics, and operational tooling.

## Domain Notes

- Currency is Vietnamese dong (VND).
- Product categories should support Vietnamese skincare terms:
  - Serum
  - Kem Duong
  - Toner
  - Sua Rua Mat
  - Mat Na
  - Kem Chong Nang
- Product copy should support benefits, ingredients, and how-to-use sections.
- Product images and logos are available under `public/` and root logo files.

## Resolved Technical Decisions

- Frontend: React + Vite + TypeScript.
- Backend: Node.js + Express + TypeScript.
- Database: MongoDB + Mongoose.
- API style: REST.
- Auth: secure JWT/session with backend RBAC.
- Deployment target: DigitalOcean Droplet + PM2/Nginx, with MongoDB Atlas or managed MongoDB.
- MVP product images: local server upload storage under `/uploads/products`, 1-6 images per product, Admin upload/replace/delete, URL/path metadata in MongoDB, storefront reads URLs normally, no S3/Cloudinary/MinIO/CDN/transformation pipeline/complex media manager.
- MVP revenue: sum of `grandTotal` for paid non-cancelled orders by `paidAt`; delivered-only revenue is Phase 2 reporting.

## Source Files For AI/BMAD

Use these files in this order:

1. `requirements.md` - canonical product requirements.
2. `descriptions.md` - short project and journey summary.
3. `erd.md` - entity/data model reference.
4. `api-spec.md` - starting API route reference.
5. `qa-feature-regression.md` - acceptance/regression checklist.
6. `admin-dashboard-mvp.md` - MVP admin/employee dashboard scope.
7. `admin-dashboard-phase-2.md` - advanced admin scope.
8. `payment-design.md` - Phase 2 payment integration notes; do not use for MVP manual payment implementation.

## Build Guidance For Future AI Agents

- Start from the requirements, not from old implementation files.
- Keep the first implementation boring and small.
- Backend RBAC, order status rules, stock changes, and payment state are the highest-risk areas.
- Prefer one clear API contract and one clear data model over compatibility with old repo quirks.
- Verify each completed slice with the smallest reliable test: API smoke check for backend logic, browser check for user flows.
