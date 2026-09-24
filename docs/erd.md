# DrDo.vn MVP ERD

MVP enum constraints:

- `USERS.status`: `active`, `blocked`, `inactive`
- `USERS.roles`: `customer`, `employee`, `admin`
- `ORDERS.paymentStatus`: `unpaid`, `paid`
- `ORDERS.paymentMethod`: `cod`, `bank_transfer`, `momo_manual`
- `ORDERS.orderStatus`: `pending`, `processing`, `shipped`, `delivered`, `cancelled`
- `PAYMENTS.status`: `unpaid`, `paid`
- `PROMOTIONS.discountType`: `percentage`, `fixed_amount`
- `COUPON_REDEMPTIONS.status`: `applied`, `released`

```mermaid
erDiagram
  USERS {
    string _id PK
    string email UK
    string phone
    string passwordHash
    string fullName
    string avatarUrl
    string status
    string[] roles
    datetime createdAt
    datetime updatedAt
    datetime lastLoginAt
  }

  ADDRESSES {
    string _id PK
    string userId FK
    string fullName
    string phone
    string line1
    string line2
    string ward
    string district
    string province
    boolean isDefault
    datetime createdAt
    datetime updatedAt
  }

  BRANDS {
    string _id PK
    string name UK
    string slug UK
    string logoUrl
    string description
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  CATEGORIES {
    string _id PK
    string name
    string slug UK
    string parentId FK
    int sortOrder
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  PRODUCTS {
    string _id PK
    string name
    string slug UK
    string sku UK
    string brandId FK
    string[] categoryIds
    string shortDescription
    string description
    number listPrice
    number salePrice
    string currency
    number stockOnHand
    number stockReserved
    boolean isActive
    boolean isDeleted
    string[] imageUrls
    string[] tags
    number ratingAvg
    number ratingCount
    datetime createdAt
    datetime updatedAt
  }

  CARTS {
    string _id PK
    string userId FK
    datetime updatedAt
  }

  CART_ITEMS {
    string _id PK
    string cartId FK
    string productId FK
    int qty
    number unitPriceSnapshot
    datetime addedAt
  }

  ORDERS {
    string _id PK
    string orderNo UK
    string userId FK
    string paymentMethod
    string paymentStatus
    string orderStatus
    datetime paidAt
    number subtotal
    number discountAmount
    object couponRef
    number pointsRedeemed
    number pointsDiscountAmount
    number shippingFee
    number grandTotal
    string inventoryState
    string membershipTierCode
    string shippingFullName
    string shippingPhone
    string shippingLine1
    string shippingLine2
    string shippingWard
    string shippingDistrict
    string shippingProvince
    string contactEmail
    string notesCustomer
    string notesInternal
    string createdBy FK
    datetime createdAt
    datetime updatedAt
  }

  ORDER_ITEMS {
    string _id PK
    string orderId FK
    string productId FK
    string nameSnapshot
    string skuSnapshot
    number unitPrice
    int qty
    number lineTotal
  }

  ORDER_STATUS_EVENTS {
    string _id PK
    string orderId FK
    string fromStatus
    string toStatus
    string changedBy FK
    string reason
    datetime createdAt
  }

  PROMOTIONS {
    string _id PK
    string name
    string discountType
    number discountValue
    number maxDiscountAmount
    datetime startAt
    datetime endAt
    number minOrderTotal
    string[] productIds
    string[] categoryIds
    string[] brandIds
    string[] tierCodes
    boolean isActive
    boolean isDeleted
    datetime createdAt
    datetime updatedAt
  }

  COUPONS {
    string _id PK
    string code UK
    string promotionId FK
    number usageLimitTotal
    number usageLimitPerCustomer
    boolean isActive
    boolean isDeleted
    datetime createdAt
    datetime updatedAt
  }

  COUPON_REDEMPTIONS {
    string _id PK
    string couponId FK
    string promotionId FK
    string orderId FK UK
    string orderNo
    string userId FK
    string code
    number discountAmount
    string status
    datetime releasedAt
    datetime createdAt
  }

  PAYMENTS {
    string _id PK
    string orderId FK
    string method
    string status
    number amount
    string currency
    string updatedBy FK
    string note
    datetime paidAt
    datetime createdAt
    datetime updatedAt
  }

  AUDIT_LOGS {
    string _id PK
    string actorId FK
    string action
    string entityType
    string entityId
    string details
    datetime createdAt
  }

  ROLES {
    string _id PK
    string name UK
    string description
  }

  ROLE_PERMISSIONS {
    string _id PK
    string roleId FK
    string permissionKey
  }

  USERS ||--o{ ADDRESSES : has
  USERS ||--o{ CARTS : owns
  CARTS ||--o{ CART_ITEMS : contains
  PRODUCTS ||--o{ CART_ITEMS : in_cart

  BRANDS ||--o{ PRODUCTS : brands
  CATEGORIES ||--o{ CATEGORIES : parent_of
  CATEGORIES }o--o{ PRODUCTS : categorizes

  USERS ||--o{ ORDERS : places
  ORDERS ||--o{ ORDER_ITEMS : includes
  PRODUCTS ||--o{ ORDER_ITEMS : sold_as

  ORDERS ||--o{ ORDER_STATUS_EVENTS : status_history
  USERS ||--o{ ORDER_STATUS_EVENTS : changes

  PROMOTIONS ||--o{ COUPONS : issues
  COUPONS ||--o{ COUPON_REDEMPTIONS : redeemed_as
  ORDERS ||--o| COUPON_REDEMPTIONS : applies
  USERS ||--o{ COUPON_REDEMPTIONS : redeems

  ORDERS ||--o{ PAYMENTS : has
  USERS ||--o{ PAYMENTS : updates

  USERS }o--o{ ROLES : assigned
  ROLES ||--o{ ROLE_PERMISSIONS : grants

  USERS ||--o{ AUDIT_LOGS : performs
```

MVP entities added 2026-07-26 alongside the PRD scope change: `WISHLIST_ITEMS`, `REVIEWS`, `BANNERS`, `MEMBERSHIP_TIERS`, `LOYALTY_LEDGER`, `LOYALTY_ACCOUNTS`, `PROMOTIONS`, `COUPONS`, `COUPON_REDEMPTIONS`, `AUDIT_LOGS`.

Note on ORDERS: the totals block is exactly the seven FR-09.7 fields, always stored even when zero. `couponRef` is an embedded immutable snapshot (couponId, promotionId, code, discountType, discountValue, maxDiscountAmount), null when no coupon was used. `inventoryState` (`reserved` | `deducted` | `released`) is the exactly-once marker that makes shipment deduction and cancellation release idempotent without transactions (ADR-0011).

Note on COUPONS: `code` is unique and uppercased. Soft deletion rewrites it to `<code>--del-<ts>` so the original code is freed for reuse while the row (and `couponRef.couponId` on historical orders) survives.

There is deliberately **no `PAYMENTS` collection** in MVP: order-level `paymentStatus`/`paidAt` plus the audit log already satisfy FR-04.9-04.12, and a separate document would be a second source of truth. It returns in Phase 2 when real gateway attempts need modelling.

Phase 2 entities: payment provider events, returns, refunds, and stock history.
