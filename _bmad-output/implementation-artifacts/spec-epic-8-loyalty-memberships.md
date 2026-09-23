---
title: 'Epic 8 — Loyalty and Memberships'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'full'
baseline_commit: '28ff0d7ddb38038d902f56de2b31811ac27ba81f'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** DrDo has no loyalty system. Orders already carry `pointsRedeemed`/`pointsDiscountAmount`/`membershipTierCode` fields that are always zero/null, and checkout always charges a flat 30,000đ shipping fee.

**Approach:** Add `MembershipTier` and append-only `LoyaltyLedgerEntry`/`LoyaltyAccount` models; derive balance and lifetime-earned from the ledger; award points once per order at `shipped` (unique partial index on accrual entries); accept point redemption in checkout with strict rejection rules; evaluate tier free-shipping after coupon discount and before point redemption; expose customer summary/history and admin tier-config/manual-adjustment APIs plus UI.

## Boundaries & Constraints

**Always:**
- Ledger is append-only; balance = Σ delta, lifetimeEarned = Σ max(0,delta). Every entry stores actor, orderId/orderNo (when applicable), delta, balanceAfter, kind, reason, createdAt.
- Accrual only at `processing→shipped`, once per order — DB safeguard: unique partial index on `(orderId)` where `kind='accrual'`; duplicate-key → silent no-op. Write a row even when awarded = 0.
- earnBase = `totals.grandTotal - totals.shippingFee`; base = floor(earnBase/1000); awarded = floor(base × multiplier of customer's CURRENT tier at shipment). Recalc tier after each positive ledger write; tier only moves up; tier changes write `tier_change` entries.
- Redemption: 10đ/point, multiples of 100, ≤ balance, ≤ 20% of subtotal → else 400 rejection (never clamp). Deduct at order creation inside the existing compensate-on-failure block; cancelled orders do NOT refund.
- Free shipping: base = `subtotal - discountAmount` (pre-redemption); fee = 0 when tier threshold is 0 (always) or base ≥ threshold; else flat 30,000đ. `null` threshold = no benefit.
- Manual adjustment: admin-only, `reason` required, audit `loyalty.points_adjustment`; employee gets 403 via existing `requireRole('admin')`.
- Seeded tiers: BRONZE 0/1.0x/null; SILVER 2000/1.1x/500000; GOLD 5000/1.25x/300000; PLATINUM 15000/1.5x/0.
- Reuse `computeOrderTotals`, `recordAudit`, `parseInput`, pagination utils, `{data}`/`{data,meta}` envelopes, `useAsync`/`StateBlock`/`Pagination`, `formatVnd`, existing CSS classes (no Tailwind in repo).

**Never:**
- No mutable point-balance counter anywhere; no transactions/DB sessions (project uses claim-before-work per ADR-0011).
- No coupon/promotion implementation (Epic 9 not built — `discountAmount` stays 0 but ordering must be correct for when it lands).
- No point refund on cancellation; no tier downgrade; no employee point adjustment; no changes to existing endpoint shapes (additive only).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Accrual at shipped | order grandTotal 2,150,000, fee 30,000, Bronze | +2,120 pts (floor(2,120,000/1000)×1.0), accrual entry, balance updates | none |
| Zero accrual | earnBase < 1000 | accrual entry with delta=0 still written (idempotency marker) | none |
| Duplicate ship | accrual already exists for orderId | second attempt no-ops via unique index | catch 11000, continue |
| Multiplier | Silver customer (lifetime ≥2000), base 1000 | 1,100 pts awarded | none |
| Tier upgrade | accrual pushes lifetime past next threshold | tierCode rises, `tier_change` ledger entry delta=0 | none |
| Redeem ok | 500 pts, balance 800, subtotal 300,000 | -500 entry, discount 5,000đ | none |
| Not multiple | 150 pts | reject | 400 INVALID_POINTS_AMOUNT |
| Cap exceeded | subtotal 300,000, redeem 7,000 pts (>6,000đ cap) | reject | 400 POINTS_CAP_EXCEEDED |
| Insufficient | balance 300, redeem 500 | reject | 400 INSUFFICIENT_POINTS |
| Free ship order | Gold customer, subtotal 350,000 ≥ 300,000; redeem pts | fee=0 evaluated on 350,000 pre-redemption | none |
| Admin adjust | POST {points:-200, reason:'X'} | entry + audit; balance drops | missing reason → 400 |
| Employee adjust | employee token | 403 | FORBIDDEN |

</frozen-after-approval>

## Code Map

- `apps/api/src/models/` — add `MembershipTier.ts`, `LoyaltyLedgerEntry.ts`, `LoyaltyAccount.ts` (userId→current tierCode; not a balance counter)
- `apps/api/src/modules/loyalty/` — new module: `loyalty.service.ts` (aggregate, appendEntry, accrual, redemption validation, tier recalc), `loyalty.routes.ts` (`GET /loyalty`, `GET /loyalty/history`), `loyaltyAdmin.routes.ts` (`GET/PATCH /admin/loyalty/tiers`, `GET /admin/customers/:id/loyalty`, `POST /admin/customers/:id/loyalty/adjustments`), `loyalty.dto.ts`
- `apps/api/src/modules/orders/order.service.ts` — `checkout()`: parse `pointsToRedeem`, validate, tier-aware shippingFee, `membershipTierCode` snapshot, redeem ledger write inside compensate block; `previewOrder()`: accept `{ pointsToRedeem }`, return `loyalty` info + tier shipping
- `apps/api/src/modules/orders/orderManagement.service.ts` — `transitionOrderStatus`: after `consumeOrderReservation` on shipped, call accrual
- `apps/api/src/seed/loyalty.seed.ts` + `registry.ts` — upsert 4 tiers; accrue for shipped seed orders
- `apps/api/src/app.ts` — mount loyalty routers
- `apps/api/src/modules/orders/orderTotals.ts` — reuse; add REDEMPTION constants (step 100) if needed
- `apps/web/src/api/loyalty.ts` + `types/loyalty.ts`, `pages/LoyaltyPage.tsx`, route `/loyalty`, nav link in `Layout.tsx`
- `apps/web/src/pages/CheckoutPage.tsx` — points input + apply, re-preview, show discount/free-shipping rows
- `apps/web/src/pages/OrderDetailPage.tsx` — show pointsRedeemed row if > 0
- `apps/web/src/pages/admin/AdminCustomerDetailPage.tsx` — loyalty panel + adjustment form; `AdminLoyaltyTiersPage.tsx` + `/admin/loyalty` route + nav item; `api/admin.ts` extensions
- `apps/api/src/modules/loyalty/loyalty.test.ts` — integration tests (mongo test DB pattern from checkout.test.ts)

## Tasks & Acceptance

**Execution:**
- [ ] `models/MembershipTier.ts`, `models/LoyaltyLedgerEntry.ts`, `models/LoyaltyAccount.ts` — schemas + indexes (unique partial accrual index; userId+createdAt for history)
- [ ] `modules/loyalty/loyalty.service.ts` — `getLoyaltySummary`, `appendEntry` (derived balance, negative-balance guard), `accrueForOrder` (11000-tolerant), `redeemPoints`, `recalculateTier`, `tierForFreeShipping`
- [ ] `modules/loyalty/loyalty.routes.ts` + `loyaltyAdmin.routes.ts` + `loyalty.dto.ts` — customer + admin endpoints
- [ ] `order.service.ts` — checkout redemption + preview + tier shipping
- [ ] `orderManagement.service.ts` — accrual hook at shipped
- [ ] `seed/loyalty.seed.ts`, `seed/registry.ts`, `app.ts` — wiring
- [ ] web: types/api/pages/routes/nav — customer loyalty page, checkout points UI, admin customer loyalty panel, admin tiers page
- [ ] `modules/loyalty/loyalty.test.ts` — the 10 required test cases

**Acceptance Criteria:**
- Given a processing order, when it transitions to shipped, then exactly one accrual entry exists and replays add nothing
- Given a customer with points, when they redeem a valid amount at checkout, then totals show the discount and the ledger shows the deduction at order creation
- Given a tier with a free-shipping threshold, when discounted subtotal meets it, then shippingFee=0 regardless of points redeemed
- Given an admin, when adjusting points with a reason, then a ledger entry and audit log exist; an employee attempting it gets 403

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence / Route |
|---------|---------|------------------|
| `.playwright-mcp/` snapshots (16 files incl. personal ChatGPT session data, one 0-byte) in diff | low → defer | Pre-existing untracked debris, not created by this story. Route: defer (repo hygiene — remove + gitignore). |
| `_bmad/render/**` rendered workflow output in diff | low → defer | Generated BMAD artifacts, pre-existing/tooling-owned, not this story's code. Route: defer. |
| `_bmad` Python tooling + `_bmad-output` docs vendored in diff | low → defer | BMAD installation scaffolding predates this run's code changes. Route: defer. |
| Unrelated assets: `design-system/drdo-vn→brand` rename, `brandkit.png`, `logo-*.png`, root `favicon.png` | low → defer | Pre-existing untracked assets from a separate brand workstream. Route: defer. |
| `_bmad/scripts/setup.py` ships without a paired test file | low → defer | Vendored tooling, not this story. Route: defer. |
| `undoOrderWrites` deletes ledger rows (`order.service.ts`) — violates literal "append-only" | low → rejected | Delete runs only on checkout-failure compensation where the repo deletes every other order write too (items, events, order). Visible outcome correct; reversal-entry fix adds new semantics for a rare path. |
| `appendEntry` negative-balance guard is aggregate-then-insert, not atomic (docstring overclaims serialization) | low → patch | Verified: two concurrent appends can both pass the guard. Rare (same-user concurrent checkout, ms window), auditable via balanceAfter; spec bans the atomic fix (no transactions, no balance counter). Patch: honest docstring. |
| `recalculateTier` compares `minLifetimePoints` floors not rank; missing current tier doc skips guard → possible demotion | low → patch | Verified at loyalty.service.ts:208-211: non-monotonic floor edits block legit promotion; `current === null` drops the upward-only guard entirely. Patch: compare sorted-list positions, skip when current unranked. |
| `getLoyaltySummary`/`getCustomerLoyalty` GETs call `getOrCreateAccount` — reads create documents | low → patch | Verified at loyalty.service.ts:293. `getAccount` exists for exactly this. Patch: read-only lookup, default BRONZE. |
| Tier deactivation silently strips holders' benefits; summary shows `tier: null`, nextTier may name lower tier | low → rejected | Benefit loss is the literal meaning of admin deactivation (spec permits `isActive` edits). Requires deliberate admin action; guard/warn fix adds complexity. |
| `OrderDetailPage.tsx` missing the spec'd `pointsRedeemed` row | false | OrderDetailPage.tsx:95-100 already renders the points row (`totals.pointsDiscountAmount > 0` + `pointsRedeemed`). Spec item satisfied by existing code. |
| Typed-but-unapplied points silently dropped at checkout submit | low → patch | Verified: `handleSubmit` sends only `appliedPoints`; typed input with no apply-click yields no discount and no signal. Patch: derive points from dirty input on submit. |
| `displayOrder` accepted by PATCH but absent from `MembershipTierDto` and web `MembershipTier` — write-only field | low → patch | Verified: loyalty.dto.ts:4-12 and types/loyalty.ts:2-9 both lack it; spec lists display order as a tier field. Patch: expose in DTO + type. |
| No uniqueness validation on `minLifetimePoints` — equal floors pick arbitrarily | low → rejected | Requires admin misconfiguring seeded floors; rank-position fix (above) removes the arbitrary demotion path. Guard adds cross-doc validation complexity. |
| `seedLoyalty` `$set` clobbers admin tier edits and reactivates disabled tiers on re-run | low → patch | Verified loyalty.seed.ts:19-23 — every field overwritten each seed run. Patch: `$setOnInsert`. |
| Accrual `accrueForOrder` error after status committed → shipped order without points, transition can't retry | false | Spec Design Notes mandate error propagation "like the existing inventory side-effect"; FR-08.6 manual admin adjustment is the documented correction path. |
| Seed backfill matches only `orderStatus: 'shipped'`, misses `delivered` | false | orders.seed.ts creates only pending/processing/shipped/cancelled; no delivered seeds exist, and live orders pass through the shipped transition where accrual fires. |
| Partial unique index: second `kind='accrual'` entry with `orderId: null` → 11000 silent no-op | false | Only `accrueForOrder` writes accrual entries and always sets `orderId`; no reachable path creates a null-orderId accrual. |
| `redeemPoints` with `points <= 0` would write a positive-delta 'redemption' | false | Sole caller (`checkout`) gates on `pointsToRedeem > 0` and `validateRedemption` rejects non-positive; unreachable. |
| `listLoyaltyHistory` sorts by `createdAt` only — same-ms entries unstable across pages | low → patch | Verified loyalty.service.ts:329. Patch: add `_id: -1` tiebreak. |
| `applyPoints` failure leaves stale `appliedPoints` that still gets submitted | false | On apply error the UI shows the error AND the persistent "Đang dùng X điểm" state; submitting the last server-validated amount is correct last-valid-state behavior. |
| `recordAudit`/`recalculateTier` failure after `appendEntry` → un-audited adjustment; retry double-applies | low → rejected | No-transaction constraint (ADR-0011) means any ordering leaves a window; audit-first just inverts it. Admin sees balance/history before retrying. |
| `recalculateTier` saves tierCode before appending `tier_change`; concurrent accruals can double-write | low → rejected | Same no-transaction constraint — reordering moves the window rather than closing it; harm is a missing/duplicate history row. |
| Gap: `POST /orders/preview` success path unverified (totals + `loyalty` block) | medium → patch | Pre-verified by lens: only error-path preview calls exist in tests; preview/checkout divergence would ship undetected. Add integration assertions. |
| Gap: `GET`/`PATCH /api/admin/loyalty/tiers` never exercised | medium → patch | Pre-verified: no test hits either tiers endpoint; `freeShippingThreshold: null` semantics unverified. Add tests. |
| Gap: `GET /api/loyalty/history` + `requireRole('customer')` gate unexercised | medium → patch | Pre-verified: no customer history call, no staff→403 check on loyalty routes. Add tests. |
| Gap: `appendEntry` negative-balance guard unreachable by tests (over-balance admin adjustment) | medium → patch | Pre-verified: all rejection tests throw in `validateRedemption` upstream. Add over-balance adjustment → 400 `INSUFFICIENT_POINTS`. |
| Additional spec'd behaviors untested: PLATINUM threshold=0 always-free, `null` threshold no-benefit, cancelled-order non-refund, rejected redemption leaves no entry | medium → patch | Spec invariants with no covering test; same patch action (extend loyalty.test.ts). |
| Test-order coupling: `loyalty.test.ts` asserts absolute `summary.balance === 1920` dependent on earlier tests | low → patch | Verified line 452 — breaks under name filtering. Patch: dedicated user or relative assertion. |
| Tests require MongoDB with no skip guard | false | Every repo test file is Mongo-backed by convention; spec Verification section documents the requirement. |
| Cap base mismatch claim (cap on raw subtotal vs discounted) | false | Spec matrix fixes cap at "20% of subtotal"; code uses raw subtotal for the cap and discounted subtotal for free shipping — exactly as specified. |
| "After coupon discount" ordering vacuous (`discountAmount = 0` hardcoded) | false | Spec Never list: "discountAmount stays 0 but ordering must be correct for when it lands" — structural ordering is the requirement and it is correct. |
| Preview applies strict rejection beyond the intent's "checkout" wording | false | Spec mandates same rules at preview ("is the only way the checkout screen sees server-computed totals"); additive per spec. |
| Idempotency verified at service surface rather than route | false | The unique-index replay check calls `accrueForOrder` directly; a route-level re-ship is impossible by design (INVALID_STATUS_TRANSITION). |

## Design Notes

Tier source of truth: `LoyaltyAccount.tierCode` persists the current tier so admin threshold edits never demote anyone (upward-only). Balance/lifetime are always aggregated; `balanceAfter` on each entry is a write-time audit snapshot, not a counter. Accrual errors propagate like the existing inventory side-effect (status already committed; manual adjustment is the correction path per FR-08.6).

## Verification

**Commands:**
- `npm run typecheck` and `npm run build` — expected: clean
- `npm run test -w @drdo/api` — expected: all pass (needs local MongoDB — already running on 127.0.0.1:27017)
- `npm run lint` — expected: clean
