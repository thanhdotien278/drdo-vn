---
title: 'Epic 9 — Promotions and Coupons (Stories 9.2–9.4)'
type: 'feature'
created: '2026-09-24'
status: 'done'
route: 'full'
baseline_commit: '7f4dd790227cbbfacbfb1f217cbfa032632a1799'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** DrDo has no promotions/coupons. The Story 9.1 totals block exists (`discountAmount`, `couponRef` always 0/null) and checkout hardcodes `discountAmount = 0`.

**Approach:** Add `Promotion`/`Coupon`/`CouponRedemption` models; admin-only audited CRUD with soft delete; server-side coupon validation in `checkout`/`previewOrder` with the per-reason error codes fixed by `docs/qa-feature-regression.md` §14.5; one `CouponRedemption` per order created at checkout and released on pre-shipment cancellation; admin usage counts + redemption history; coupon apply/remove UI in checkout mirroring the Epic 8 points pattern.

## Boundaries & Constraints

**Always:**
- `Promotion`: `name`, `discountType: percentage|fixed_amount`, `discountValue`, `maxDiscountAmount?`, `startAt?`/`endAt?` (open-ended allowed), `minOrderTotal` (default 0), scope arrays `productIds`/`categoryIds`/`brandIds` (scope = the discount base), `tierCodes[]` (empty = all tiers), `isActive`, `isDeleted`.
- `Coupon`: `code` normalized uppercase + unique index (case-insensitive), `promotionId`, `usageLimitTotal`/`usageLimitPerCustomer` (null = unlimited), `isActive`, `isDeleted`. Soft delete releases the code via `--del-<ts>` suffix (taxonomy pattern) so it can be recreated; historical orders resolve via `couponRef.couponId`.
- `CouponRedemption`: `couponId`, `promotionId`, `orderId` (unique — one coupon per order), `orderNo`, `userId`, `code` snapshot, `discountAmount`, `status: applied|released`, `releasedAt`. Usage limits count `applied` rows only.
- Validation order + codes (all `400`, fixed by QA §14.5): `COUPON_NOT_FOUND` (unknown or soft-deleted) → `COUPON_INACTIVE` (coupon or its promotion disabled/deleted — indistinguishable) → `COUPON_NOT_STARTED` → `COUPON_EXPIRED` → `COUPON_TIER_INELIGIBLE` → `COUPON_MIN_ORDER_NOT_MET` (vs cart subtotal) → `COUPON_NOT_APPLICABLE` (scope base = 0) → `COUPON_USAGE_LIMIT_REACHED` → `COUPON_CUSTOMER_LIMIT_REACHED`.
- Discount: `percentage` → `floor(base × value/100)`; `fixed_amount` → `value`; then `min(discount, maxDiscountAmount ?? ∞, base)`. Scope empty → base = subtotal.
- Totals ordering (Epic 8 contract): subtotal → coupon `discountAmount` → tier free shipping on `subtotal − discountAmount` → points redemption (cap still on full subtotal). All money server-side via existing `computeOrderTotals`.
- `couponRef` snapshot gains `promotionId` (ERD lists it; additive field, default null).
- Redemption write sits inside checkout's compensate-on-failure block (`undoOrderWrites` deletes it). Cancellation release hooks `transitionOrderStatus`'s `cancelled` branch via claim-before-work `applied → released`.
- Admin mutations audit-logged: `promotion.create|update|status_change|delete`, `coupon.*` same. Employee read-only = order `totals.couponRef` already in staff DTO — no new employee route.
- `checkoutSchema`/`previewSchema` gain optional `couponCode` (trimmed, ≤50 chars); preview applies the same validation so the checkout screen shows real discounts.

**Never:**
- No stacking (one `couponCode` field), no auto-apply promotions, no client-trusted totals, no hard delete, no DB transactions (ADR-0011), no employee/customer mutation route, no payment gateways or other Phase 2 work, no redesign of the Story 9.1 totals block.
- Usage-limit check-then-insert is not atomic — same accepted residual race as the loyalty ledger; document it, don't add locking.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Percentage + cap | 10% coupon, `maxDiscountAmount` 50k, base 800k | discountAmount = 50,000 | none |
| Fixed | 50k coupon, minOrder 300k, subtotal 500k | discountAmount = 50,000 | none |
| Scope base | 20% off brand X; cart = 300k X-line + 2M other | discount = 60,000 (QA §14.5) | none |
| Case-insensitive | `drdo10` vs `DRDO10` | same coupon resolves | none |
| Release on cancel | applied coupon, order cancelled pre-ship | redemption `released`, limit freed | none |
| Immutable snapshot | promotion edited after order | order keeps old code/value | none |
| Deleted coupon on old order | coupon soft-deleted | `couponRef` still renders code | none |
| Unknown/deleted/inactive/expired/not-started/min-order/scope/tier/total-limit/customer-limit code | preview or checkout | distinct code per QA §14.5 | `400` with that code |
| Employee/customer hits admin promo routes | any admin coupon/promotion route | `403` | `FORBIDDEN` |
| Duplicate code on create | existing code any case | rejected | `409 COUPON_CODE_TAKEN` |

</frozen-after-approval>

## Code Map

- `apps/api/src/models/` — new `Promotion.ts`, `Coupon.ts`, `CouponRedemption.ts` (mirror `Banner.ts`/`LoyaltyLedgerEntry.ts` style).
- `apps/api/src/modules/promotions/` — new module: `promotion.service.ts` (admin CRUD + `resolveCoupon` validation + `computeDiscount` + `releaseCouponRedemption`), `promotion.dto.ts`, `promotionAdmin.routes.ts`, `promotions.test.ts`.
- `apps/api/src/modules/orders/order.service.ts` — `checkout`/`previewOrder`: accept `couponCode`, resolve+validate before stock reservation, pass `discountAmount`/`couponRef` into `computeOrderTotals`, write redemption inside the try block; `undoOrderWrites` deletes redemptions.
- `apps/api/src/modules/orders/orderTotals.ts` — add `promotionId` to `OrderCouponSnapshot` + `couponSnapshotSchema`.
- `apps/api/src/modules/orders/orderManagement.service.ts` — cancelled branch calls `releaseCouponRedemption(order._id)`.
- `apps/api/src/modules/orders/order.dto.ts` — map `couponRef.promotionId`.
- `apps/api/src/app.ts` — mount `promotionAdminRouter` under `/api/admin`.
- `apps/api/src/seed/promotions.seed.ts` + `registry.ts` — promotions + coupons covering the QA rejection cases (active, expired, not-started, inactive, tier-restricted, min-order, scoped, limited).
- `apps/web/src/api/promotions.ts`, `types/promotion.ts` — admin promotion/coupon clients + types.
- `apps/web/src/api/orders.ts`, `types/commerce.ts` — `previewOrder`/`CheckoutInput` take `couponCode`; type `couponRef` fully.
- `apps/web/src/pages/CheckoutPage.tsx` — coupon apply/remove panel (mirrors points UI), discount row with code in the totals block, pass `couponCode` to `createOrder`.
- `apps/web/src/pages/admin/AdminPromotionsPage.tsx` + `AdminCouponsPage.tsx` — list/create/edit/toggle/delete + usage count and per-coupon redemption table.
- `apps/web/src/pages/admin/AdminLayout.tsx`, `App.tsx` — nav items + routes `/admin/promotions`, `/admin/coupons`.
- `apps/web/src/pages/OrderDetailPage.tsx`, `components/staff/StaffOrderDetailPage.tsx` — show coupon code on the discount row.
- `docs/api-spec.md`, `docs/erd.md` — new endpoints, RBAC rows, entity blocks.

## Tasks & Acceptance

**Execution:**
- [ ] `models/Promotion.ts`, `models/Coupon.ts`, `models/CouponRedemption.ts` — create schemas per boundaries
- [ ] `modules/promotions/promotion.dto.ts` — admin DTOs for promotion, coupon (+`usageCount`), redemption
- [ ] `modules/promotions/promotion.service.ts` — CRUD, `resolveCoupon`, `computeDiscount`, `releaseCouponRedemption`, redemption listing
- [ ] `modules/promotions/promotionAdmin.routes.ts` — `/admin/promotions*` and `/admin/coupons*` under `requireRole('admin')`; mount in `app.ts`
- [ ] `orderTotals.ts` — add `promotionId` to snapshot; `order.dto.ts` map it
- [ ] `order.service.ts` — wire coupon into `checkout` + `previewOrder`; redemption write + compensation
- [ ] `orderManagement.service.ts` — release redemption on cancel
- [ ] `seed/promotions.seed.ts` + `registry.ts` — seed data
- [ ] `modules/promotions/promotions.test.ts` — integration tests covering the whole I/O matrix (real Mongo, same harness as `checkout.test.ts`)
- [ ] web: `types/promotion.ts`, `api/promotions.ts`, `api/orders.ts`, `types/commerce.ts`
- [ ] web: `CheckoutPage.tsx`, `OrderDetailPage.tsx`, `StaffOrderDetailPage.tsx`
- [ ] web: `AdminPromotionsPage.tsx`, `AdminCouponsPage.tsx`, `AdminLayout.tsx`, `App.tsx`
- [ ] `docs/api-spec.md`, `docs/erd.md` — document endpoints/entities

**Acceptance Criteria:**
- Given a valid coupon, when a customer previews/checkouts with `couponCode`, then totals show the server-computed discount and the order stores the immutable `couponRef` snapshot plus one `applied` redemption.
- Given each rejection state in QA §14.5, when a coupon is applied, then the response is `400` with the matching distinct code.
- Given an order with an applied coupon, when staff cancels it pre-shipment, then the redemption becomes `released` and usage counts drop.
- Given a non-admin role, when calling any `/admin/promotions*` or `/admin/coupons*` route, then `403`.
- Given a soft-deleted/edited promotion+coupon, when viewing a historical order, then `couponRef` still renders the original code and rule.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Lens | Finding | Verdict | Evidence / Route |
|---|------|---------|---------|------------------|
| 1 | blind-hunter | `preview.reload()` fallback invisible once `previewOverride` set; stale totals after failed checkout | medium | Verified: `effectivePreview = previewOverride ?? preview.data` (CheckoutPage.tsx:220); catch-path reload never reaches the display. → patch |
| 2 | blind-hunter | Post-failure re-preview syncs `appliedCoupon` but not `appliedPoints` | medium | Verified: recovery branch sets only `setAppliedCoupon` (:168); stale `appliedPoints` is resent by later `applyCoupon`/submit. → patch |
| 3 | blind-hunter | Failed "Gỡ mã" clears input before `applyCoupon('')` resolves → ghost coupon resubmitted | medium | Verified: `setCouponInput('')` precedes the await; on failure `appliedCoupon` survives and `submittedCoupon` falls back to it. → patch |
| 4 | blind-hunter | `coupon.isDeleted` in `resolveCoupon` unreachable for suffixed deletes — misleading comment | low | Real but cosmetic; normal path can't reach it (suffix makes lookup miss). Fix = honest comment. → patch |
| 5 | blind-hunter | `discountValue` has no upper bound for `percentage` (>100 silently becomes 100%-off) | medium | Verified: `z.number().min(0)` at promotion.service.ts:190; `computeDiscount` clamps to base. → patch (group: numeric validation) |
| 6 | blind-hunter | `discountValue`/`minOrderTotal` accept fractional VND (no `.int()`); `maxDiscountAmount` API bound (min 1) stricter than model (min 0) | low | Verified at :190,:194. Stricter API than model is the safe direction for maxDiscountAmount; `.int()` needed for money fields. → patch (group: numeric validation) |
| 7 | blind-hunter | Coupon `code` has no charset validation | low | Rejected: unlikely met in everyday use (admin-entered codes work verbatim); fix adds a guard constraint the spec never asked for. |
| 8 | blind-hunter | `limitOrNull` swallows NaN → null → silently clears a usage limit | low | Rejected: `type="number"` input blocks everyday bad input; residue cases (paste/`1e2`) are rare; fix adds guards. |
| 9 | blind-hunter | Promotion picker truncates at 48 active promotions | low | Rejected: >48 active promotions unlikely at MVP scale; real fix needs picker search/pagination — more than a direct correction. |
| 10 | blind-hunter | Coupon on disabled/deleted promotion displays "Đang bật"; `promotionId` filter unreachable; `fetchAdminCoupons` hardcodes limit 12 | low | Rejected: misleading label only — promotion status is visible on its own page and checkout still rejects correctly; fixes add DTO surface/coupling. |
| 11 | blind-hunter | `productIds`/`tierCodes` are raw free-text fields | low | Rejected: minimal admin UI per spec note; typos surface as server 400s; real fix is picker/search UI — non-trivial. |
| 12 | blind-hunter | Redemption-history table omits the customer | low | Rejected: customer is reachable via `orderNo` → order detail; a useful column needs a user join (new DTO surface). |
| 13 | blind-hunter | `productIds`/`categoryIds` scope branches and coupon+points combo untested | medium | Verified: `promotions.test.ts` only exercises `brandIds` scope and never combines coupon with `pointsToRedeem`. → patch (test-only) |
| 14 | blind-hunter | `releaseCouponRedemption` throw after committed cancel leaves redemption stuck `applied` | low | Rejected: same accepted residual as `releaseOrderReservation`/`accrueForOrder` beside it — the function's comment documents crash-under-applies as deliberate (ADR-0011). |
| 15 | blind-hunter | `JSON.stringify` diffing is order-sensitive → phantom `promotion.update`/`coupon.update` audit entries | low | Verified at :1387,:1619: reordered `tierCodes`/`productIds` produce audit noise for a no-change save. → patch |
| 16 | blind-hunter | `COUPON_MIN_ORDER_NOT_MET` details payload undocumented; ERD lacks `--del-<ts>` convention | low | Verified against api-spec.md/erd.md. → patch (docs) |
| 17 | edge-case-hunter | `releaseCouponRedemption` throw after committed cancel | low | Duplicate of #14 — same claim, same verdict. Rejected. |
| 18 | edge-case-hunter | `--del-<ts>` suffix collision → 11000 → 500 on delete | false | Disproved: collision requires a pre-existing code equal to `<code>--del-<exact future epoch ms>`; unreachable in practice, and a loud 500 on an unreachable path is correct behavior. |
| 19 | edge-case-hunter | `applyCoupon`/`applyPoints` previews in flight simultaneously → last-write-wins desync | medium | Verified: neither apply button is disabled while the other applies; submit also ignores in-flight applies. → patch |
| 20 | edge-case-hunter | `limitOrNull` NaN → null | low | Duplicate of #8. Rejected. |
| 21 | edge-case-hunter | `datetime-local` unparsable → RangeError, `submitting` stuck | false | Disproved: the input type guarantees empty-or-valid; a non-empty unparsable value cannot be produced through the UI. |
| 22 | edge-case-hunter | Admin promotion form numeric coercion (`Number(...) || 0`, NaN→null) | low | Rejected with #8/#20: number inputs + server validation make everyday harm unlikely; fix adds guards. |
| 23 | edge-case-hunter | >48 active promotions can't be selected in coupon form | low | Duplicate of #9. Rejected. |
| 24 | edge-case-hunter | `discountValue` >100 for percentage | medium | Duplicate of #5 — same root cause. → patch (numeric validation group) |
| 25 | edge-case-hunter | `discountAmount=0` coupon consumes a usage slot, hidden by `>0` display gates | low | Verified real but root cause is the same loose numeric validation — `.int().min(1)` on `discountValue` prevents zero-effect promotions. → patch (numeric validation group) |
| 26 | edge-case-hunter | Promotion soft-deleted while coupons stay `isActive=true` → "Đang bật" | low | Duplicate of #10. Rejected. |
| 27 | edge-case-hunter | `fixed_amount` decimals accepted (no `.int()`) | low | Duplicate of #6 — numeric validation group. → patch |
| 28 | edge-case-hunter | Recovery path doesn't sync `appliedPoints` | medium | Duplicate of #2. → patch |
| 29 | verification-gap | `PATCH /admin/coupons/:id` has no success-path test | medium | Pre-verified by lens (RBAC loop hits only the 403 path; a dropped `isActive` field would silently no-op). → patch |
| 30 | verification-gap | `GET /admin/promotions` `statusFilter` has no success-path test | medium | Pre-verified: only the 403 RBAC hit exercises it; a broken filter would leak/hide rows silently. → patch |
| 31 | verification-gap | `promotionName` on `GET /admin/coupons` never asserted | low | Pre-verified: a broken join renders '—' with no failing test. → patch |
| 32 | verification-gap | `undoOrderWrites` redemption cleanup runs on a failure path no test reaches | defer | Pre-verified: real-Mongo harness has no seam to force a failure after the redemption write; identical gap predates the change for the loyalty ledger. → deferred-work.md |
| 33 | verification-gap | Loyalty accrual now computed on post-coupon `grandTotal` — intended base unpinned | maybe-false | earnBase = `grandTotal − shippingFee` (loyalty.service.ts:159); coupons lower grandTotal → fewer points. Post-coupon accrual matches "points on amount paid," but if the intent is pre-coupon accrual this is medium. Settles via a product decision on the accrual base. → deferred-work.md (severity unverified) |
| 34 | verification-gap | Promotion picker capped at 48 | low | Duplicate of #9/#23. Rejected. |
| 35 | intent-alignment | Soft-deleted coupon resolves `COUPON_NOT_FOUND` vs flat §14.5 reading of `COUPON_INACTIVE` | false | The frozen spec block fixes this exactly: "`COUPON_NOT_FOUND` (unknown or soft-deleted)". Conformance, not divergence. |
| 36 | intent-alignment | Rejection ordering is the spec's own construction, not fixed by §14.5 | false | The frozen block enumerates the order explicitly; the code implements it verbatim. |
| 37 | intent-alignment | "Pre-shipment" guarantee is inherited from `ORDER_STATUS_TRANSITIONS`, not the new code | false | Verified: `cancelled` is only reachable from `pending`/`processing`; borrowed guarantee holds. |
| 38 | intent-alignment | UI surface (checkout panel, admin pages, discount rows) ships untested | defer | Real gap, but the repo has no UI test harness — pre-existing, not caused by this story. → deferred-work.md |
| 39 | intent-alignment | Second-coupon rejection tested at model layer, not API | false | No API path exists to attempt a second coupon; the unique `orderId` index is the correct enforcement surface and the 11000 test exercises it. |
| 40 | intent-alignment | `couponCode` >50 chars returns generic zod 400, not `COUPON_NOT_FOUND` | false | Still a 400 rejection; a >50-char code can never exist (schema caps creation at 50). Harmless. |

## Design Notes

`resolveCoupon(code, { userId, lines, products, tierCode })` is the single validation entry shared by `checkout` and `previewOrder` — preview must agree with the order (QA §14.6). Scope match = line's product ∈ `productIds` OR its `category`/`brand` ∈ scope arrays.

## Verification

**Commands:**
- `npm run typecheck` — clean in both workspaces
- `npm test -w @drdo/api` — all tests incl. new `promotions.test.ts` pass (needs local MongoDB on `mongodb://127.0.0.1:27017`)
- `npm run build` — api + web build clean
- `npm run lint` — clean
