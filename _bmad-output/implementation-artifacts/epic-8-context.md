# Epic 8 Context: Loyalty and Memberships

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give every customer a loyalty account with a ledger-derived point balance, lifetime-earned total, and a membership tier that grants an earn multiplier and a free-shipping benefit. Points accrue once per order at `shipped`, are redeemable at checkout for a VND discount, and are admin-adjustable with an audit trail. Tier config is seeded and admin-manageable.

## Stories

- Story 8.1: Membership tiers and seeded tier configuration
- Story 8.2: Loyalty ledger and derived balance
- Story 8.3: Point accrual on shipped
- Story 8.4: Point redemption at checkout
- Story 8.5: Tier free-shipping benefit
- Story 8.6: Customer loyalty view and point history
- Story 8.7: Admin loyalty adjustment and tier config

## Requirements & Constraints

- Each customer has a loyalty account: current point balance, lifetime earned points, membership tier. Balance and lifetime totals are derived from an append-only ledger — never a mutable counter.
- Points accrue only when an order reaches `orderStatus=shipped` — the single accrual trigger. At most once per order, enforced by a DB-level safeguard (unique partial index); a ledger row is written even when zero points are awarded.
- Earn base = `grandTotal - shippingFee` (the amount actually paid for goods, after coupon discount and point redemption). Base points = `floor(earnBase / 1000)`. Awarded = `floor(basePoints * tierEarnMultiplier)` using the customer's tier at the moment of shipment.
- Tier is determined by lifetime earned points, recalculated immediately after each accrual, moves up only, and tier changes are recorded in the ledger.
- Redemption at checkout: 10 VND per point, multiples of 100 only, bounded by balance, capped at 20% of cart subtotal. Invalid redemption is rejected, never silently reduced. Points are deducted at order creation and NOT refunded on cancellation in MVP (refund = manual admin adjustment).
- Tier free-shipping threshold is evaluated against cart subtotal AFTER coupon discount and BEFORE point redemption; point redemption can never cost the customer free shipping. When met, shippingFee = 0.
- Every ledger entry records actor, order reference when applicable, delta, resulting balance, reason, timestamp.
- Customers can view balance, tier, progress to next tier, and paginated point history.
- Admins can view a customer's loyalty account and adjust points manually with a required reason; adjustments are audit-logged. Employees cannot adjust points.
- Tier fields: name, lifetime-point threshold, earn multiplier, free-shipping threshold (tri-state: null = none, 0 = always free), display order.
- Seeded tiers: Bronze 0pts/1.0x/no free shipping; Silver 2,000pts/1.1x/free ship over 500,000đ; Gold 5,000pts/1.25x/free ship over 300,000đ; Platinum 15,000pts/1.5x/always free (threshold 0).

## Technical Decisions

- Reuse the existing seven-field order totals block (`subtotal`, `discountAmount`, `couponRef`, `pointsRedeemed`, `pointsDiscountAmount`, `shippingFee`, `grandTotal`) computed server-side via `computeOrderTotals`; `pointsRedeemed`/`pointsDiscountAmount` fields already exist and stay zero until now. `grandTotal` is clamped ≥ 0.
- Order already stores `membershipTierCode` (tier snapshot at checkout) — explains historical free-shipping orders.
- Backend RBAC is the security boundary: loyalty adjustment and tier config are Admin-only; employees get 403. Audit logging covers manual point adjustments (actor, action, entity, prev/next, reason).
- `POST /orders/preview` is the only way the checkout screen sees server-computed shipping/grandTotal before submit — it must now account for tier free shipping and point redemption.
- Cancellation after `shipped` is already blocked, so accrual needs no reversal path.
- Tier benefits feed promotion eligibility (Epic 9), but Epic 9 coupons may not be built yet — keep a clean seam, don't build promotions.
- New entities named in the ERD note: `MEMBERSHIP_TIERS`, `LOYALTY_LEDGER`, `LOYALTY_ACCOUNTS` (shapes not defined in ERD — derive from FR-08).

## Cross-Story Dependencies

- 8.2 ledger + 8.1 tiers are foundations for everything else.
- 8.3 accrual hooks the shared order-status transition to `shipped` (Epic 4 path — `orderManagement.service`).
- 8.4 redemption + 8.5 free shipping both modify checkout/order-creation and `orders/preview` (Epic 3 path — `order.service`); free-shipping must be evaluated in the documented order (subtotal → coupon discount → free-shipping check → points redemption).
- 8.6/8.7 are read/write surfaces over 8.1–8.2.
