# DrDo.vn — Storefront catalog

Website bán sản phẩm chăm sóc da (giai đoạn 1: catalog + trang sản phẩm công khai).

- `apps/api` — Node.js + Express + TypeScript + MongoDB (Mongoose)
- `apps/web` — React + Vite + TypeScript

Phần khách hàng (giỏ hàng, đặt hàng), nhân viên và admin chưa nằm trong phạm vi này.

## Yêu cầu

- Node.js >= 20
- MongoDB đang chạy (mặc định `mongodb://127.0.0.1:27017/drdo`)

## Cài đặt & chạy

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run seed        # tạo danh mục, thương hiệu, 16 sản phẩm mẫu + ảnh placeholder
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173
```

Lệnh khác: `npm run lint`, `npm run typecheck`, `npm run build`.

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

- `/` — trang chủ: hero, danh mục, bán chạy, đang giảm giá, hàng mới
- `/san-pham` — danh sách có tìm kiếm, lọc (danh mục, thương hiệu, khoảng giá, tình trạng kho), sắp xếp, phân trang (state lưu trên URL)
- `/san-pham/:slug` — chi tiết: ảnh, giá VND, khuyến mãi, tồn kho, thành phần, công dụng, hướng dẫn dùng, sản phẩm liên quan
