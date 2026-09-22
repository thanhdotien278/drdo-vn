# Admin Dashboard – Sprint 3 (Clean MVP)

## 1. Purpose
This document defines the **clean, MVP-focused requirements** for the Admin & Employee Dashboard in **Sprint 3** of the DrDo.vn project.

Sprint 3 focuses on **core operational capabilities** required to run the business daily, avoiding over-engineering and advanced analytics.

---

## 2. Scope (Sprint 3 Only)

### In Scope
- Admin dashboard (core management)
- Employee dashboard (order processing)
- Role-based access control (RBAC)
- Product, category, brand management (basic)
- Order management
- Manual payment status management
- Customer account viewing
- Audit logging (mandatory)
- Promotions & coupon management (Admin-only)
- Banner management and review moderation
- Membership tier configuration and manual loyalty point adjustment (Admin-only)

### Out of Scope
- Payment configuration
- Email/SMS notifications
- Advanced analytics & reports
- Data export
- System-wide settings

---

## 3. User Roles & Permissions

### Roles
- **Admin**
- **Employee**
- **Customer** (no dashboard access)

### Permission Rules
- Admin has full access to all Sprint 3 features.
- Employee has **limited access** (order-related operations only).
- Authorization must be enforced on **backend APIs**.
- Frontend role checks are for UX only.

---

## 4. Access Control

### Route Protection
- All routes under:
  - `/admin/*`
  - `/employee/*`
  must require authentication.

### Authorization
- Unauthorized access:
  - API → HTTP 403
  - Frontend → redirect to `/login`

---

## 5. Dashboard Home (Admin)

### Required Metrics (Basic Only)
- Total orders (today / this week)
- Total revenue (today / this week)
- Orders grouped by status
- Low stock products list

Revenue is the sum of `grandTotal` for orders where `paymentStatus=paid` and `orderStatus != cancelled`, counted by `paidAt`.

⚠️ No charts or trend analysis in Sprint 3.

---

## 6. Product Management (Admin)

### Features
- Create product
- Edit product
- Soft delete product
- Update price and stock
- Activate / deactivate product

### Product Fields (Sprint 3)
- Name
- Category
- Brand
- Original price
- Sale price
- Stock quantity
- Status (active / inactive)
- Basic image upload (1-6 images)

### Rules
- No product variants
- No advanced rich text editor
- Store uploaded product files under `/uploads/products`
- Store only image URL/path metadata in MongoDB
- Admin can upload, replace, and delete product images
- Public storefront reads image URLs normally from product data
- Keep upload storage behind a small service interface
- No S3, Cloudinary, MinIO, CDN, image transformation pipeline, or complex media manager
- Soft delete only

---

## 7. Category & Brand Management (Admin)

### Features
- Create
- Edit
- Soft delete

### Rules
- Deletion is blocked if products are assigned
- Admin must reassign products before deletion

---

## 8. Order Management (Admin & Employee)

### Order Status Flow
Pending → Processing → Shipped → Delivered
                     ↘ Cancelled


### Status Change Rules
- Pending → Processing (Admin, Employee)
- Processing → Shipped (Admin, Employee)
- Shipped → Delivered (Admin, Employee)
- Cancelled allowed only from Pending or Processing
- Delivered is a final, immutable state

### Features
- View order list
- Filter by status
- View order details
- Update order status
- Manually update payment status to `unpaid` or `paid`

---

## 9. Customer Management (Admin)

### Features
- View customer list
- View customer profile
- View order history
- Block / unblock customer account

⚠️ No password reset or data export in Sprint 3.

---

## 10. User & Staff Management (Admin)

### Features
- View staff list (admin & employee)
- Create staff accounts
- Assign role (admin / employee)
- Activate / deactivate staff accounts

### Rules
- Admin cannot deactivate or delete their own account
- All staff actions must be logged

---

## 11. Inventory Rules

- Stock is reduced when an order is marked as **Shipped**
- Reserved stock is released if an order is **Cancelled** before shipping
- Cancellation after **Shipped** is blocked in MVP
- Inventory updates must be deterministic

---

## 12. Audit Logging (Mandatory)

### Actions to Log
- Order status changes
- Payment status changes
- Product create / update / delete
- Category & brand changes
- Customer block / unblock changes
- Staff role or status changes

### Log Fields
- actorId
- action
- entityType
- entityId
- timestamp
- optional structured details

---

## 13. Definition of Done (Sprint 3)

Sprint 3 is considered complete when:
- Admin can manage products, categories, brands
- Employee can process orders correctly
- RBAC is enforced at API and UI level
- Order status changes are logged
- Payment status changes are logged
- No out-of-scope features are implemented
