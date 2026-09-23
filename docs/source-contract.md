# DrDo.vn Source Contract

This document is the developer source index for the clean rebuild. Prefer these files over any legacy DrDo2/DrDo3 layout or Phase 2 assumptions.

## Authoritative domain decisions

| Priority | Path | Role |
| --- | --- | --- |
| 1 | `docs/prd.md` | Product requirements — wins on any conflict |
| 2 | `docs/epics.md` | Epic/story breakdown and execution waves |

## Core product source references

| Path | Role |
| --- | --- |
| `docs/requirements.md` | Functional requirements |
| `docs/descriptions.md` | Feature descriptions and journeys |
| `docs/erd.md` | Data model / ERD notes |
| `docs/api-spec.md` | REST API contract and RBAC matrix |
| `docs/admin-dashboard-mvp.md` | Admin MVP scope |
| `docs/qa-feature-regression.md` | QA / regression expectations |
| `docs/payment-design.md` | Payment design (manual MVP; no gateway) |

## MVP hard constraints (do not re-litigate in code)

- Payment gateway integration is **out of MVP** (no MoMo gateway/IPN/callback/payUrl/signature).
- MVP payment is **manual only**: `paymentStatus` is `unpaid` | `paid`; `paymentMethod` is `cod` | `bank_transfer` | `momo_manual`.
- Admin and Employee may manually update `paymentStatus`; Customer may not. Every payment status change writes an audit log.
- Promotions/coupons are **Phase 1 / MVP**: Admin-only writes, Employee read-only in order context, one coupon per order, validated server-side, snapshotted immutably onto the order. Coupon delete is a soft delete.
- Order totals are a fixed **seven-field block** (`subtotal`, `discountAmount`, `couponRef`, `pointsRedeemed`, `pointsDiscountAmount`, `shippingFee`, `grandTotal`), stored on every order even when zero, computed server-side, `grandTotal` never negative. Client-supplied totals are never trusted.
- Loyalty points accrue at **`shipped`**, never at `paid`, at most once per order. Balances derive from an append-only ledger.
- Reviews are **moderated**: a new review starts `pending`; only approved reviews are public.
- Wishlist, reviews, banners, loyalty and memberships are **in MVP**.
- **No multi-document transactions** — the dev/test database is a standalone `mongod`. Multi-write operations use conditional atomic updates plus compensation.
- Current-user endpoint: `GET /api/auth/me`.
- Orders store an immutable shipping/contact snapshot; **no postalCode**.
- Cancellation after `shipped` is **blocked** in MVP.
- Product images: local disk `/uploads/products` only. Banner images follow the same rules under `/uploads/banners`.
- Backend RBAC is authoritative; frontend checks are UX only. **Roles are exact** — an admin does not implicitly have the `employee` role.
- Anonymous protected API requests return `401`; authenticated users without permission return `403`.
- On any conflict between documents, `docs/prd.md` wins.

## Runtime layout (Story 1.1 scaffold)

```
apps/api/   Express + TypeScript API (port 4005)
apps/web/   React + Vite + TypeScript web app (port 5173, proxy /api + /uploads)
docs/       Product and source references
```

No old DrDo2/DrDo3 application structure is copied into this scaffold; the `docs/` references above are carried over as product specifications only.
