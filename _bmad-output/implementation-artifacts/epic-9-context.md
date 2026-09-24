# Epic 9 Context: Promotions and Coupons

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give admins full lifecycle control of promotions and coupon codes, and let customers apply at most one coupon at checkout with server-side validation, a per-reason rejection code, an immutable snapshot on the order, and usage accounting that releases on pre-shipment cancellation. Employees see coupon info read-only in order context only.

## Stories

- Story 9.1: Order totals block and discount snapshot (done in Wave 0 — reuse, do not redesign)
- Story 9.2: Promotion/coupon data model and Admin management
- Story 9.3: Coupon validation at checkout
- Story 9.4: Coupon redemption, release, and usage reporting

## Requirements & Constraints

- Admin-only create/edit/enable/disable/soft-delete for promotions and coupons; employees get 403 on mutations and read-only coupon visibility in order context. Backend RBAC is the boundary.
- A promotion defines: discount type (`percentage` | `fixed_amount`), value, optional max discount cap, active date range, minimum order total, applicable products/categories/brands (the scope defines the **discount base**, not just eligibility), and applicable membership tiers.
- A coupon defines: unique **case-insensitive** code, total usage limit, per-customer usage limit; it belongs to a promotion.
- One coupon per order; no stacking.
- Checkout rejects unknown, inactive, expired, over-limit, or cart-ineligible codes with a **distinct error code per reason**.
- Totals block (Story 9.1, already built): `subtotal`, `discountAmount`, `couponRef` (embedded snapshot: couponId, promotionId?, code, discountType, discountValue, maxDiscountAmount), `pointsRedeemed`, `pointsDiscountAmount`, `shippingFee`, `grandTotal` — computed server-side, always stored, `grandTotal` clamped ≥ 0. Client totals are never trusted.
- Redemption is recorded per order/customer; cancelling before shipment releases it against usage limits. Soft-deleted/disabled coupons stop validating immediately but stay resolvable on historical orders.
- Admins can view coupon usage counts and redemption history.
- Totals ordering (Epic 8 contract): subtotal → coupon discount → tier free-shipping check (on discounted subtotal) → points redemption. Coupon discount reduces the free-shipping base.
- Promotion/coupon changes are audit-logged like other admin operations.

## Technical Decisions

- Stack: Express + Mongoose backend (`apps/api`), React+Vite frontend (`apps/web`). No DB transactions — claim-before-work / compensate-on-failure per ADR-0011 (see `inventory.ts`, `undoOrderWrites` in `order.service.ts`).
- Reuse `computeOrderTotals` and `orderTotalsSchema` (already has `couponRef` snapshot shape with `discountType`/`discountValue`/`maxDiscountAmount`), `parseInput`, `recordAudit`, pagination utils, `{data}`/`{data,meta}` envelopes, `requireRole('admin')`.
- New collections per ERD note: `PROMOTIONS`, `COUPONS`, `COUPON_REDEMPTIONS` (shapes derived from FR-09).
- Checkout seams already exist: `checkoutSchema`/`previewSchema` in `order.service.ts`, `POST /orders/preview` for the checkout screen, `POST /orders` for creation. `discountAmount` is currently hardcoded 0 — replace with real coupon resolution.
- Cancellation release hooks the shared `transitionOrderStatus` in `orderManagement.service.ts` (`toStatus === 'cancelled'` branch, after `releaseOrderReservation`).
- Tier eligibility reads `membershipTierCode` from the loyalty account (`getOrCreateAccount`/`getAccount` in `loyalty.service.ts`).
- Audit actions follow `<entity>.<verb>` convention (e.g. `banner.create`, `category.status_change`).

## UX & Interaction Patterns

- Checkout page (`CheckoutPage.tsx`) already has a points-apply pattern: input + apply/remove buttons that re-call `POST /orders/preview` and store the result in `previewOverride`; the totals block in `cart-summary` renders discount rows. Coupon UI mirrors this.
- Admin pages use `admin-page`/`admin-table`/`admin-panel`/`form-grid` CSS classes, `useAsync`, `StateBlock`, `Pagination`, `formatVnd`. No Tailwind in repo — plain CSS in `styles/global.css`.
- Vietnamese UI copy; VND currency formatting via `formatVnd`.

## Cross-Story Dependencies

- 9.2 models + admin CRUD are the foundation; 9.3 validation consumes them in `checkout`/`previewOrder`; 9.4 redemption/release hooks order creation and `transitionOrderStatus` cancellation.
- Epic 8 tier codes feed promotion tier eligibility; Epic 8 free shipping evaluates after coupon discount (ordering already correct).
