# DrDo.vn — Storefront catalog

Website bán sản phẩm chăm sóc da thiên nhiên (giai đoạn 1: catalog + trang sản phẩm công khai).

- `apps/api` — Node.js + Express + TypeScript + MongoDB (Mongoose)
- `apps/web` — React + Vite + TypeScript (React Router, plain CSS)

Phần khách hàng (giỏ hàng, đặt hàng), nhân viên và admin chưa nằm trong phạm vi này.

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
#    CORS_ORIGIN=http://localhost:5173 — chỉnh nếu cần.

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
| `npm run seed` | Seed lại dữ liệu mẫu vào MongoDB |

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

## Trang web

- `/` — trang chủ: hero, sản phẩm nổi bật, thành phần thiên nhiên, bộ sưu tập bán chạy, testimonial, cam kết bền vững
- `/san-pham` — danh sách có tìm kiếm, lọc (danh mục, thương hiệu, khoảng giá, tình trạng kho), sắp xếp, phân trang (state lưu trên URL); mobile dùng nút `Bộ lọc`
- `/san-pham/:slug` — chi tiết: ảnh, giá VND, khuyến mãi, tồn kho, thành phần, công dụng, hướng dẫn dùng, sản phẩm liên quan

Giao diện theo design system trong `design-system/drdo-vn/MASTER.md` (forest green + ivory, Playfair Display + Inter). Ảnh minh họa trong `apps/web/public/images/` là ảnh tạo — thay bằng ảnh sản phẩm DRDO thật khi có.
