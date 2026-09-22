# Phase 2 Payment Architecture & Design

## 1. Objective
The goal of this Phase 2 note is to design future payment architecture after the manual-payment MVP is stable. It is not part of the MVP contract.
**NO PAYMENT CODE** is required for MVP. MVP checkout creates `paymentStatus=unpaid` orders, and Admin/Employee manual confirmation is the only way to mark an order `paid`.

## 2. Scope

### In Scope
1.  **MoMo Payment Integration Design**: Redirect flow, IPN handling, Transaction verification.
2.  **Bank Transfer Design**: Manual transfer flow, Admin confirmation.
3.  **Database Design**: Schema for `payments` and updates to `orders`.
4.  **Security Strategy**: Signature verification, idempotency, race condition prevention.

### Out of Scope
-   Cod Implementation (COD) (Existing functionality).
-   Real code implementation of payment gateways.
-   Frontend integration (UI components).
-   External SDK integration.

## 3. Payment Flow Design

### A. MoMo Payment Flow
This flow describes the interaction between the User, Our Backend, and MoMo API.

1.  **Initiation**:
    -   Customer selects a future MoMo gateway option.
    -   Client sends `POST /api/orders` (existing) and gets `orderNo`.
    -   Client sends `POST /payments/momo/initiate { orderNo }`.
    -   Backend creates a `Payment` record (status: `pending`).
    -   Backend constructs MoMo request payload (signature signed with HMAC SHA256).
    -   Backend returns `payUrl` (MoMo checkout URL).

2.  **User Action**:
    -   Customer is redirected to `payUrl`.
    -   Customer completes payment on MoMo app/web.
    -   MoMo redirects user back to `returnUrl` (e.g., `/checkout/result`).

3.  **Callback (IPN) & Verification**:
    -   MoMo sends asynchronous POST to `/payments/momo/callback`.
    -   **Backend Verification**:
        1.  Validate **Signature** (compare computed vs received).
        2.  Check for **Duplicate** `requestId` (Idempotency).
        3.  Find `Payment` by `orderId`.
        4.  Verify `amount` matches expected amount.
    -   **Update State**:
        -   If Success: `Payment.status = success`, `Order.paymentStatus = paid`.
        -   If Fail: `Payment.status = failed`.
    -   **Response**: Return HTTP 204 to MoMo to acknowledge receipt.

### B. Bank Transfer (Manual) Flow
1.  **Initiation**:
    -   Customer selects "Bank Transfer".
    -   Order created with `paymentStatus = unpaid`.
    -   System shows Bank Account details to customer.

2.  **Customer Action**:
    -   Customer transfers money via their banking app.
    -   Customer provides Reference Code (e.g., `OrderNo`) in transfer note.
    -   Optionally, Customer clicks "I have transferred" (Client calls `POST /payments/bank/confirm`).

3.  **Admin Verification**:
    -   Admin or Employee checks Bank Statement.
    -   Admin or Employee finds Order in Dashboard.
    -   Admin or Employee clicks "Mark as Paid".
    -   System updates `Order.paymentStatus = paid` and records an audit log.

## 4. Database Design

### `payments` Collection
New collection to track all payment attempts and transactions.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Primary Key |
| `orderId` | ObjectId (Ref: Order) | Yes | Link to Order |
| `userId` | ObjectId (Ref: User) | Yes | Payer ID |
| `method` | Enum | Yes | `momo_manual`, `bank_transfer` |
| `status` | Enum | Yes | `pending`, `success`, `failed`, `refunded` |
| `amount` | Number | Yes | Amount in base currency |
| `currency` | String | Yes | Default `VND` |
| `transactionId` | String | No | Provider's Transaction ID (e.g., MoMo TransId) |
| `requestId` | String | No | Unique ID sent to Provider (for Idempotency) |
| `metadata` | Object | No | Raw response/debug info |
| `createdAt` | Date | Yes | Timestamp |
| `updatedAt` | Date | Yes | Timestamp |

**Indexes**:
-   `{ orderId: 1 }`
-   `{ transactionId: 1, method: 1 }` (Unique for verifying callbacks)
-   `{ requestId: 1 }` (Unique where applicable)

### Updates to `orders` Collection
Existing `IOrder` interface updates:
-   **paymentStatus**: MVP order enum remains `['unpaid', 'paid']`.
-   **paymentMethod**: MVP order enum remains `['cod', 'momo_manual', 'bank_transfer']`.

### `payment_events` Collection (Audit Log)
Optional but recommended for debugging IPN callbacks.
-   `payload`: Mixed (Full JSON body from callback)
-   `headers`: Mixed
-   `ip`: String
-   `processed`: Boolean
-   `error`: String

## 5. API Contract Design

### 1. Initiate MoMo Payment
-   **Endpoint**: `POST /payments/momo/initiate`
-   **Auth**: Required (User)
-   **Request**:
    ```json
    { "orderNo": "ORD-123456" }
    ```
-   **Response**:
    ```json
    {
      "payUrl": "https://test-payment.momo.vn/...",
      "requestId": "uuid-v4",
      "checkSum": "..."
    }
    ```

### 2. MoMo IPN Callback
-   **Endpoint**: `POST /payments/momo/callback`
-   **Auth**: None (Public, validated via Signature)
-   **Request**: (Standard MoMo IPN Body)
    ```json
    {
      "partnerCode": "MOMO",
      "orderId": "ORD-123456",
      "requestId": "...",
      "amount": 500000,
      "orderInfo": "...",
      "orderType": "momo_wallet",
      "transId": "230492834",
      "resultCode": 0,
      "message": "Success",
      "payType": "qr",
      "responseTime": 123456789,
      "extraData": "",
      "signature": "a1b2c3d4..."
    }
    ```
-   **Response**: `204 No Content`

### 3. Bank Transfer Confirmation (User Signal)
-   **Endpoint**: `POST /payments/bank/confirm`
-   **Auth**: Required (User)
-   **Request**:
    ```json
    { "orderNo": "ORD-123456", "note": "Transferred via VCB" }
    ```
-   **Response**:
    ```json
    { "success": true, "message": "Confirmation received" }
    ```

## 6. Security & Reliability Strategy

### Callback Verification (MoMo)
-   **Signature**: Compute HMAC-SHA256 of the raw payload using `Secret Key`. Compare with `req.body.signature`. **Reject if mismatch.**
-   **Amount Check**: Compare `req.body.amount` with `Order.grandTotal`. **Flag anomaly if mismatch.**

### Idempotency
-   **Problem**: MoMo might retry callbacks if we don't respond quickly (or network issues).
-   **Solution**:
    -   Check if `Payment` with this `requestId` or `transactionId` is already `success`.
    -   If yes, return `204` immediately without re-processing logic to avoid double-crediting or loop.

### Concurrency
-   Use MongoDB atomic operators (`$set`) where possible.
-   For order status updates, consider optimistic locking (versioning) if high concurrency is expected. Phase 2 payment callbacks must not bypass the order state machine or mark cancelled orders paid without an approved reversal workflow.

## 7. Risks & Mitigation
-   **Risk**: MoMo secret keys leak.
    -   *Mitigation*: Use Environment Variables (`MOMO_SECRET_KEY`). Never commit to git.
-   **Risk**: Callback not received (Network partition).
    -   *Mitigation*: Implement a CRON job / "Check Status" button to proactively query MoMo Transaction Status API for pending orders > 15 mins.

## 8. Exit Criteria
-   [ ] Payment integration scope is explicitly accepted as Phase 2.
-   [ ] Database schema definitions are agreed upon.
-   [ ] MoMo callback verification and idempotency rules are agreed upon.
-   [ ] Bank transfer admin confirmation flow is agreed upon.
