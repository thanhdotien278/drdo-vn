# DrDo.vn — Storefront catalog

Website bán sản phẩm chăm sóc da thiên nhiên (hiện có: catalog công khai, đăng ký/đăng nhập với RBAC backend, giỏ hàng + sổ địa chỉ + checkout/đơn hàng cho khách — Epic 3).

- `apps/api` — Node.js + Express + TypeScript + MongoDB (Mongoose), JWT Bearer auth
- `apps/web` — React + Vite + TypeScript (React Router, plain CSS)

Nghiệp vụ nhân viên (Epic 4) và admin (Epic 5) chưa nằm trong phạm vi này — các route `/api/*/rbac-smoke` chỉ là seam để kiểm chứng phân quyền. Checkout không đánh dấu đơn là đã thanh toán; thanh toán là thủ công (Epic 4).

Tài liệu nguồn (source of truth) nằm trong `docs/` — xem `docs/source-contract.md` để biết thứ tự đọc và các ràng buộc MVP.

## Cấu trúc

```
apps/
  api/        Backend Express + Mongoose (port 4000)
  web/        Frontend React + Vite (port 5173, proxy /api → :4000)
design-system/drdo-vn/MASTER.md   Design tokens & visual spec của giao diện
```

## Yêu cầu

- **Node.js >= 20** (kiểm tra: `node -v`)
- **MongoDB** đang chạy — một trong các cách sau:
  - MongoDB Community Server cài trực tiếp: https://www.mongodb.com/try/download/community
  - Docker: `docker run -d --name drdo-mongo -p 27017:27017 mongo:7`
  - MongoDB Atlas (URI cloud, sửa `MONGODB_URI` trong `apps/api/.env`)

## Cài đặt & chạy

```bash
# 1. Cài dependencies (npm workspaces, chạy ở thư mục gốc)
npm install

# 2. Tạo file môi trường cho API
cp apps/api/.env.example apps/api/.env
#    Mặc định: PORT=4000, MONGODB_URI=mongodb://127.0.0.1:27017/drdo,
#    CORS_ORIGIN=http://localhost:5173, JWT_SECRET=<dev fallback>, JWT_EXPIRES_IN=7d
#    → chỉnh nếu cần; môi trường thật BẮT BUỘC đặt JWT_SECRET riêng.

# 3. Seed dữ liệu mẫu (danh mục, thương hiệu, 16 sản phẩm + ảnh placeholder)
npm run seed

# 4. Chạy API (terminal 1)
npm run dev:api     # http://localhost:4000 — health: http://localhost:4000/health

# 5. Chạy web (terminal 2)
npm run dev:web     # http://localhost:5173
```

Mở **http://localhost:5173** — frontend tự proxy `/api` và `/uploads` sang `localhost:4000`, không cần cấu hình thêm. Nếu chạy API ở host/port khác, tạo `apps/web/.env` với `VITE_API_BASE_URL=http://<host>:<port>/api`.

> Chạy cả hai cùng lúc: `npm run dev` (chạy `dev` của mọi workspace song song).

## Lệnh khác

| Lệnh | Mô tả |
| --- | --- |
| `npm run lint` | ESLint tất cả workspace |
| `npm run typecheck` | `tsc --noEmit` tất cả workspace |
| `npm run build` | Build API (tsc) + web (vite build → `apps/web/dist`) |
| `npm run seed` | Seed lại dữ liệu mẫu vào MongoDB (users → catalog → orders; `npm run seed -- users` chạy từng phần) |
| `npm test` | Test tất cả workspace; API integration test cần MongoDB đang chạy (mặc định DB `drdo_vn_test`, override bằng `MONGODB_TEST_URI`) |

## Tài khoản dev (chỉ cho local)

Seed tạo sẵn các tài khoản sau — chỉ dùng cho môi trường dev, không phải secret thật:

| Email | Mật khẩu | Vai trò | Trạng thái |
| --- | --- | --- | --- |
| `admin@drdo.vn` | `Admin123!` | admin | active |
| `employee@drdo.vn` | `Employee123!` | employee | active |
| `customer@drdo.vn` | `Customer123!` | customer | active |
| `blocked@drdo.vn` | `Blocked123!` | customer | blocked (để kiểm tra FR-01.4) |

## Troubleshooting

- **`MongooseServerSelectionError` / connect ECONNREFUSED 27017** — MongoDB chưa chạy. Khởi động mongod/docker container, hoặc sửa `MONGODB_URI` trong `apps/api/.env` trỏ đúng instance.
- **Trang chủ/ danh sách trống** — chưa seed: chạy `npm run seed` rồi reload.
- **`EADDRINUSE: 4000` hoặc `5173`** — đổi `PORT` trong `apps/api/.env` (và `VITE_API_BASE_URL`/proxy tương ứng), hoặc `vite --port` khác.
- **API lỗi CORS** — kiểm tra `CORS_ORIGIN` trong `apps/api/.env` trùng origin của web (mặc định `http://localhost:5173`). Dev thường không cần vì đi qua Vite proxy.

## API công khai

| Endpoint | Mô tả |
| --- | --- |
| `GET /health` | Health check |
| `GET /api/categories` | Danh mục đang hoạt động |
| `GET /api/brands` | Thương hiệu đang hoạt động |
| `GET /api/products` | Danh sách sản phẩm: `page`, `limit`, `q`, `category`, `brand`, `minPrice`, `maxPrice`, `availability`, `sort` (`newest`/`price_asc`/`price_desc`/`popular`) |
| `GET /api/products/featured` | Bán chạy / mới / đang giảm giá |
| `GET /api/products/:slug` | Chi tiết sản phẩm |
| `GET /api/products/:slug/related` | Sản phẩm liên quan |

Sản phẩm `isActive: false` hoặc `isDeleted: true` không xuất hiện ở bất kỳ API công khai nào.

## API xác thực & phân quyền

| Endpoint | Quyền | Mô tả |
| --- | --- | --- |
| `POST /api/auth/register` | public | Đăng ký — luôn tạo tài khoản `customer` |
| `POST /api/auth/login` | public | Đăng nhập cho customer/employee/admin; tài khoản `blocked`/`inactive` bị từ chối |
| `GET /api/auth/me` | đã đăng nhập | Hồ sơ hiện tại (không bao giờ trả `passwordHash`) |
| `POST /api/auth/logout` | đã đăng nhập | Xác nhận phiên (JWT stateless — client tự xóa token) |
| `GET /api/customer/rbac-smoke` | customer | Seam kiểm chứng RBAC (thay bằng route thật ở Epic 3) |
| `GET /api/employee/rbac-smoke` | employee | Seam kiểm chứng RBAC (thay bằng route thật ở Epic 4) |
| `GET /api/admin/rbac-smoke` | admin | Seam kiểm chứng RBAC (thay bằng route thật ở Epic 5) |

## API khách hàng (Epic 3)

| Endpoint | Quyền | Mô tả |
| --- | --- | --- |
| `GET /api/cart` | customer | Giỏ hàng hiện tại (tạo lười, một giỏ/khách) |
| `POST /api/cart/items` | customer | Thêm/gộp sản phẩm `{ productId, qty }` |
| `PATCH /api/cart/items/:id` | customer | Cập nhật số lượng `{ qty }` |
| `DELETE /api/cart/items/:id` | customer | Xoá sản phẩm khỏi giỏ |
| `GET /api/addresses` | customer | Sổ địa chỉ của khách |
| `POST /api/addresses` | customer | Thêm địa chỉ (không có mã bưu điện) |
| `PATCH /api/addresses/:id` | customer | Sửa địa chỉ của mình |
| `DELETE /api/addresses/:id` | customer | Xoá địa chỉ của mình |
| `PATCH /api/addresses/:id/default` | customer | Đặt địa chỉ mặc định (tối đa một) |
| `POST /api/orders` | customer | Tạo đơn từ giỏ: `{ paymentMethod, addressId? | shipping?, contactEmail?, notesCustomer? }` — đơn luôn `pending`/`unpaid` |
| `POST /api/orders/preview` | customer | Tổng tiền tính server-side trước khi đặt |
| `GET /api/orders` | customer | Đơn của mình, mới nhất trước |
| `GET /api/orders/:orderNo` | customer | Chi tiết đơn của mình (items, totals, snapshot giao hàng, timeline) |

Checkout giữ chỗ tồn kho (`stockReserved`) mà không trừ `stockOnHand`; huỷ trước giao hàng giải phóng chỗ giữ (Epic 4 xử lý trừ kho khi giao). Giá/tổng tiền luôn tính phía server.

Auth dùng JWT Bearer (`Authorization: Bearer <token>`). Quy ước lỗi: chưa đăng nhập → `401`; đã đăng nhập nhưng thiếu quyền → `403`. Role là chính xác — `admin` không tự động có quyền `employee` (xem `docs/api-spec.md`).

## Trang web

- `/` — trang chủ: hero, sản phẩm nổi bật, thành phần thiên nhiên, bộ sưu tập bán chạy, testimonial, cam kết bền vững
- `/products` — danh sách có tìm kiếm, lọc (danh mục, thương hiệu, khoảng giá, tình trạng kho), sắp xếp, phân trang (state lưu trên URL); mobile dùng nút `Bộ lọc`
- `/products/:slug` — chi tiết: ảnh, giá VND, khuyến mãi, tồn kho, thành phần, công dụng, hướng dẫn dùng, sản phẩm liên quan
- `/login`, `/register` — đăng nhập / đăng ký khách hàng (JWT lưu localStorage, tải lại phiên qua `/api/auth/me`)
- `/cart` — giỏ hàng (customer): thêm/sửa/xoá, cảnh báo hết hàng, tổng tạm tính
- `/checkout` — chọn địa chỉ đã lưu hoặc nhập mới + `cod`/`bank_transfer`/`momo_manual`; tổng tiền server-side
- `/addresses` — sổ địa chỉ: list/thêm/sửa/xoá/đặt mặc định
- `/orders`, `/orders/:orderNo` — đơn của khách, chi tiết gồm items/totals/snapshot/timeline
- `/account`, `/wishlist` — seam các epic sau, đã gắn guard UX: chưa đăng nhập → chuyển `/login?from=…`; sai role → màn hình 403

Giao diện theo design system trong `design-system/drdo-vn/MASTER.md` (forest green + ivory, Playfair Display + Inter). Ảnh minh họa trong `apps/web/public/images/` là ảnh tạo — thay bằng ảnh sản phẩm DRDO thật khi có.
