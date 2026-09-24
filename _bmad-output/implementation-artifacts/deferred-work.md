# Deferred Work

- source_spec: `/Users/Super/drdovn/_bmad-output/implementation-artifacts/spec-epic-8-loyalty-memberships.md`
  summary: Repo hygiene — `.playwright-mcp/` session snapshots (incl. personal ChatGPT account data and one 0-byte file), rendered `_bmad/render/**` output, `_bmad` tooling, and unrelated brand/favicon assets sit uncommitted in the tree.
  evidence: Pre-existing untracked files surfaced in the Epic 8 review diff; not caused by this story. Reviewers recommend deleting `.playwright-mcp/`, gitignoring it and `_bmad/render/`, and deciding whether `_bmad` tooling and brand assets belong in the repo.

- source_spec: `/Users/Super/drdovn/_bmad-output/implementation-artifacts/spec-epic-8-loyalty-memberships.md`
  summary: `_bmad/scripts/setup.py` (~1400 lines) ships with no paired test file while all five sibling scripts have tests.
  evidence: Verification-gap lens found it exercised only by running it; vendored tooling outside this story's scope.
- source_spec: `/Users/Super/drdovn/_bmad-output/implementation-artifacts/spec-9-promotions-coupons.md`
  summary: Coupon-redemption cleanup in `undoOrderWrites` (order.service.ts) runs on a post-redemption checkout-failure path no test can reach.
  evidence: Verification-gap lens confirmed the real-Mongo harness has no seam to force a failure between `writeCouponRedemption` and checkout return; identical unverified compensation predates this change for the loyalty ledger.
- source_spec: `/Users/Super/drdovn/_bmad-output/implementation-artifacts/spec-9-promotions-coupons.md`
  summary: Loyalty points accrual now computes on post-coupon `grandTotal` — whether accrual should be pre- or post-coupon was never pinned.
  evidence: `accrueForOrder` uses `grandTotal − shippingFee` (loyalty.service.ts:159); a coupon reduces `grandTotal` hence points earned. Unverified, medium if the intent is pre-coupon accrual; settles via a product decision on the accrual base.
- source_spec: `/Users/Super/drdovn/_bmad-output/implementation-artifacts/spec-9-promotions-coupons.md`
  summary: The Epic 9 UI surface (checkout coupon panel, admin promotion/coupon pages, order-detail discount rows) ships with no UI-level tests.
  evidence: Intent-alignment audit found all new tests are HTTP/model-surface; the repo has no UI test harness at all — pre-existing gap, not caused by this story.
- source_spec: code review follow-up — self-service profile & checkout saveAddress
  summary: `PATCH /auth/password` has no per-account rate limiting or lockout; a stolen session token can brute-force `currentPassword` indefinitely.
  evidence: auth.routes.ts protects the endpoint with `requireAuth` only. Review judged it acceptable to defer if tracked; needs an attempt window (e.g. 5 tries / 15 min) or backoff middleware.
- source_spec: code review follow-up — self-service profile & checkout saveAddress
  summary: `PATCH /auth/me` and `PATCH /auth/password` allow any authenticated role (employee/admin included) to edit their own profile — consistent with `GET /auth/me`, but product intent for staff self-service edits is unconfirmed.
  evidence: Only `requireAuth` is applied, not `requireRole('customer')`. Not an escalation bug (target user always comes from the token); needs a product decision.
- source_spec: code review follow-up — self-service profile & checkout saveAddress
  summary: Checkout `saveAddress` does not deduplicate — repeated opt-ins accumulate identical rows in the address book.
  evidence: `createAddress` in address.service.ts writes unconditionally. Known data-hygiene issue; fix by normalizing line1/phone and skipping exact matches.
- source_spec: code review follow-up — self-service profile & checkout saveAddress
  summary: Password policy is length-only (`min(8)`); `12345678` passes. Consistent with the existing registration schema, so it is a product decision, not a bug.
  evidence: `changePasswordSchema`/`registerSchema` in auth.service.ts. A composition check (upper/lower/digit/symbol) would need sign-off and alignment across register + change flows.
