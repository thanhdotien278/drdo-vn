import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Epic 5 integration checks — admin dashboard metrics, catalog management,
 * customer blocking, staff management, and the reused Epic 4 order workflow
 * under /api/admin. Runs against a dedicated MongoDB test database.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI_EPIC5 ?? 'mongodb://127.0.0.1:27017/drdo_vn_test_epic5';

let server: Server;
let baseUrl: string;

const PASSWORD = 'Password123!';

async function api(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; formData?: FormData } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body:
      options.formData ??
      (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  return (body.error as { code?: string } | undefined)?.code;
}

async function login(email: string, password = PASSWORD): Promise<string> {
  const res = await api('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(res.status, 200, `login ${email} failed: ${JSON.stringify(res.body)}`);
  return (res.body.data as { token: string }).token;
}

async function loginExpectFailure(email: string): Promise<number> {
  const res = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  return res.status;
}

const SHIPPING = {
  fullName: 'Nguyễn Thị Kho',
  phone: '0912345678',
  line1: '12 Đường Test',
  ward: 'Phường Test',
  district: 'Quận Test',
  province: 'TP. Hồ Chí Minh',
};

let adminToken = '';
let customerToken = '';
let staffToken = '';
let adminUserId = '';
let admin2UserId = '';
let staffUserId = '';
let customerId = '';
let customer2Id = '';
let categoryId = '';
let brandId = '';
let productId = '';
let lowStockProductId = '';

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5EQlI=',
  'base64',
);

function pngFormData(count = 1, field = 'images'): FormData {
  const form = new FormData();
  for (let i = 0; i < count; i += 1) {
    form.append(field, new Blob([PNG_BYTES], { type: 'image/png' }), `test-${i}.png`);
  }
  return form;
}

async function createOrderViaApi(qty = 2): Promise<{ id: string; orderNo: string }> {
  const add = await api('POST', '/api/cart/items', {
    token: customerToken,
    body: { productId, qty },
  });
  assert.equal(add.status, 201, `add to cart failed: ${JSON.stringify(add.body)}`);
  const res = await api('POST', '/api/orders', {
    token: customerToken,
    body: { paymentMethod: 'cod', shipping: SHIPPING },
  });
  assert.equal(res.status, 201, `checkout failed: ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; orderNo: string };
}

/** Direct order fixture for dashboard math — bypasses the API clock. */
async function insertOrder(options: {
  orderNo: string;
  orderStatus: string;
  paymentStatus: string;
  paidAt: Date | null;
  createdAt?: Date;
  grandTotal: number;
}) {
  const { OrderModel } = await import('../../models/Order.js');
  const { UserModel } = await import('../../models/User.js');
  const customer = await UserModel.findOne({ email: 'cust@test.dev' }).exec();
  const order = await OrderModel.create({
    orderNo: options.orderNo,
    userId: customer!._id,
    paymentMethod: 'cod',
    paymentStatus: options.paymentStatus,
    orderStatus: options.orderStatus,
    paidAt: options.paidAt,
    totals: {
      subtotal: options.grandTotal,
      discountAmount: 0,
      couponRef: null,
      pointsRedeemed: 0,
      pointsDiscountAmount: 0,
      shippingFee: 0,
      grandTotal: options.grandTotal,
    },
    inventoryState: 'reserved',
    shippingFullName: SHIPPING.fullName,
    shippingPhone: SHIPPING.phone,
    shippingLine1: SHIPPING.line1,
    shippingWard: SHIPPING.ward,
    shippingDistrict: SHIPPING.district,
    shippingProvince: SHIPPING.province,
    contactEmail: 'cust@test.dev',
  });
  if (options.createdAt) {
    // Mongoose guards createdAt in model updates — use the raw collection.
    await OrderModel.collection.updateOne(
      { _id: order._id },
      { $set: { createdAt: options.createdAt } },
    );
  }
  return order;
}

async function productDoc(id = productId) {
  const { ProductModel } = await import('../../models/Product.js');
  return ProductModel.findById(id).exec();
}

async function auditEntries(filter: Record<string, unknown>) {
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  return AuditLogModel.find(filter).sort({ createdAt: -1 }).exec();
}

before(async () => {
  const { connectDatabase } = await import('../../db/connect.js');
  const { createApp } = await import('../../app.js');
  const { UserModel } = await import('../../models/User.js');
  const { BrandModel } = await import('../../models/Brand.js');
  const { CategoryModel } = await import('../../models/Category.js');
  const { ProductModel } = await import('../../models/Product.js');
  const { CartModel } = await import('../../models/Cart.js');
  const { CartItemModel } = await import('../../models/CartItem.js');
  const { AddressModel } = await import('../../models/Address.js');
  const { OrderModel } = await import('../../models/Order.js');
  const { OrderItemModel } = await import('../../models/OrderItem.js');
  const { OrderStatusEventModel } = await import('../../models/OrderStatusEvent.js');
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  const { hashPassword } = await import('../auth/password.js');

  await connectDatabase(TEST_MONGO_URI);
  await Promise.all([
    UserModel.deleteMany({}),
    CartModel.deleteMany({}),
    CartItemModel.deleteMany({}),
    AddressModel.deleteMany({}),
    OrderModel.deleteMany({}),
    OrderItemModel.deleteMany({}),
    OrderStatusEventModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
    ProductModel.deleteMany({}),
    BrandModel.deleteMany({}),
    CategoryModel.deleteMany({}),
  ]);

  const passwordHash = await hashPassword(PASSWORD);
  const [admin, admin2, staff, cust, cust2] = await UserModel.create([
    { email: 'admin@test.dev', passwordHash, fullName: 'Admin One', roles: ['admin'], status: 'active' },
    { email: 'admin2@test.dev', passwordHash, fullName: 'Admin Two', roles: ['admin'], status: 'active' },
    { email: 'staff@test.dev', passwordHash, fullName: 'Test Staff', roles: ['employee'], status: 'active' },
    { email: 'cust@test.dev', passwordHash, fullName: 'Khách Test', phone: '0912000111', roles: ['customer'], status: 'active' },
    { email: 'cust2@test.dev', passwordHash, fullName: 'Khách Hai', phone: '0912000222', roles: ['customer'], status: 'active' },
  ]);
  adminUserId = String(admin._id);
  admin2UserId = String(admin2._id);
  staffUserId = String(staff._id);
  customerId = String(cust._id);
  customer2Id = String(cust2._id);

  const brand = await BrandModel.create({ name: 'Test Brand', slug: 'test-brand' });
  const category = await CategoryModel.create({ name: 'Test Category', slug: 'test-category' });
  brandId = String(brand._id);
  categoryId = String(category._id);

  const product = await ProductModel.create({
    name: 'Test Serum',
    slug: 'test-serum',
    sku: 'TST-SERUM',
    price: 350_000,
    stockOnHand: 50,
    category: category._id,
    brand: brand._id,
    isActive: true,
  });
  productId = String(product._id);

  const lowStock = await ProductModel.create({
    name: 'Kem dưỡng sắp hết',
    slug: 'kem-duong-sap-het',
    sku: 'LOW-STOCK',
    price: 200_000,
    stockOnHand: 2,
    lowStockThreshold: 5,
    category: category._id,
    brand: brand._id,
    isActive: true,
  });
  lowStockProductId = String(lowStock._id);

  await ProductModel.create({
    name: 'Sản phẩm ngừng bán',
    slug: 'san-pham-ngung-ban',
    sku: 'INACTIVE-LOW',
    price: 100_000,
    stockOnHand: 0,
    category: category._id,
    brand: brand._id,
    isActive: false,
  });

  server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  adminToken = await login('admin@test.dev');
  customerToken = await login('cust@test.dev');
  staffToken = await login('staff@test.dev');
});

after(async () => {
  const { disconnectDatabase } = await import('../../db/connect.js');
  server.close();
  await disconnectDatabase();
});

// ---------- RBAC matrix ----------

test('anonymous requests to admin APIs return 401', async () => {
  for (const [method, path] of [
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/products'],
    ['GET', '/api/admin/categories'],
    ['GET', '/api/admin/customers'],
    ['GET', '/api/admin/staff'],
    ['GET', '/api/admin/orders'],
    ['PATCH', '/api/admin/staff/000000000000000000000000/status'],
  ] as const) {
    const res = await api(method, path, method === 'GET' ? {} : { body: {} });
    assert.equal(res.status, 401, `${method} ${path} must reject anonymous`);
  }
});

test('customer and employee tokens get 403 on admin management APIs', async () => {
  for (const token of [customerToken, staffToken]) {
    for (const [method, path] of [
      ['GET', '/api/admin/dashboard'],
      ['GET', '/api/admin/products'],
      ['POST', '/api/admin/products'],
      ['GET', '/api/admin/categories'],
      ['GET', '/api/admin/customers'],
      ['GET', '/api/admin/staff'],
      ['GET', '/api/admin/orders'],
      ['PATCH', '/api/admin/orders/DRD-X/status'],
    ] as const) {
      const res = await api(method, path, method === 'GET' ? { token } : { token, body: {} });
      assert.equal(res.status, 403, `${method} ${path} must reject non-admin roles`);
    }
  }
});

test('admin cannot use employee order routes (roles stay exact)', async () => {
  const res = await api('GET', '/api/employee/orders', { token: adminToken });
  assert.equal(res.status, 403);
});

// ---------- Story 5.1: dashboard ----------

test('dashboard counts orders by createdAt and revenue by paidAt on grandTotal', async () => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 3600 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
  const thisWeekNotToday = new Date(weekStart.getTime() + 60_000);

  // createdAt=now + paidAt=now: counts toward both order counts and both revenues.
  await insertOrder({ orderNo: 'DRD-D1', orderStatus: 'processing', paymentStatus: 'paid', paidAt: now, grandTotal: 100_000 });
  // createdAt=8d ago + paidAt=now: invisible to order counts, counts in revenue — proves paidAt is the revenue clock.
  await insertOrder({ orderNo: 'DRD-D2', orderStatus: 'delivered', paymentStatus: 'paid', paidAt: now, createdAt: eightDaysAgo, grandTotal: 200_000 });
  // createdAt=now + paidAt=10d ago: counts as an order this week but never in revenue.
  await insertOrder({ orderNo: 'DRD-D3', orderStatus: 'processing', paymentStatus: 'paid', paidAt: tenDaysAgo, grandTotal: 300_000 });
  // paid but cancelled: excluded from revenue.
  await insertOrder({ orderNo: 'DRD-D4', orderStatus: 'cancelled', paymentStatus: 'paid', paidAt: now, grandTotal: 500_000 });
  // unpaid: an order today, never revenue.
  await insertOrder({ orderNo: 'DRD-D5', orderStatus: 'pending', paymentStatus: 'unpaid', paidAt: null, grandTotal: 700_000 });
  // paid at the start of the week (may equal today on Mondays).
  await insertOrder({ orderNo: 'DRD-D6', orderStatus: 'pending', paymentStatus: 'paid', paidAt: thisWeekNotToday, grandTotal: 400_000 });

  const res = await api('GET', '/api/admin/dashboard', { token: adminToken });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const data = res.body.data as {
    orders: { today: number; thisWeek: number; byStatus: Record<string, number> };
    revenue: { today: number; thisWeek: number };
    lowStockProducts: Array<{ id: string; availableStock: number }>;
  };

  assert.equal(data.orders.today, 5, 'D1, D3, D4, D5, D6 were created today');
  assert.equal(data.orders.thisWeek, 5);
  // D6 only lands inside "today" when the week started today (Monday boundary).
  const expectedToday = thisWeekNotToday >= todayStart ? 300_000 + 400_000 : 300_000;
  assert.equal(data.revenue.today, expectedToday, 'revenue must follow paidAt, not createdAt');
  assert.equal(data.revenue.thisWeek, 700_000, 'paid non-cancelled grandTotals inside this week');

  assert.equal(data.orders.byStatus.processing, 2);
  assert.equal(data.orders.byStatus.delivered, 1);
  assert.equal(data.orders.byStatus.cancelled, 1);
  assert.equal(data.orders.byStatus.pending, 2);

  const lowIds = data.lowStockProducts.map((entry) => entry.id);
  assert.ok(lowIds.includes(lowStockProductId), 'low-stock product listed');
  assert.ok(!lowIds.includes(productId), 'healthy product not listed');
});

// ---------- Story 5.2: products ----------

test('admin creates a product and the storefront serves it', async () => {
  const res = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: {
      name: 'Serum Vitamin C',
      sku: 'vit-c-10',
      price: 420_000,
      salePrice: 399_000,
      stockOnHand: 12,
      category: categoryId,
      brand: brandId,
      shortDescription: 'Serum sáng da',
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const created = res.body.data as { id: string; slug: string };
  assert.equal(created.slug, 'serum-vitamin-c');

  const list = await api('GET', '/api/products?q=vitamin', {});
  const names = (list.body.data as Array<{ name: string }>).map((p) => p.name);
  assert.ok(names.includes('Serum Vitamin C'));

  const detail = await api('GET', `/api/products/${created.slug}`, {});
  assert.equal(detail.status, 200);
});

test('product validation rejects missing fields and invalid values', async () => {
  const base = { name: 'X', sku: 'X-1', price: 100, category: categoryId, brand: brandId };
  for (const [label, body, expected] of [
    ['missing name', { ...base, name: '' }, 400],
    ['missing sku', { ...base, sku: '' }, 400],
    ['negative price', { ...base, price: -1 }, 400],
    ['invalid price', { ...base, price: 'abc' }, 400],
    ['negative stock', { ...base, stockOnHand: -3 }, 400],
    ['fractional stock', { ...base, stockOnHand: 1.5 }, 400],
    ['missing category', { ...base, category: undefined }, 400],
    ['bad category ref', { ...base, category: '000000000000000000000000' }, 400],
    ['bad brand ref', { ...base, brand: '000000000000000000000000' }, 400],
  ] as const) {
    const res = await api('POST', '/api/admin/products', { token: adminToken, body });
    assert.equal(res.status, expected, `${label}: ${JSON.stringify(res.body)}`);
  }
  const badCat = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: { ...base, category: '000000000000000000000000' },
  });
  assert.equal(errorCode(badCat.body), 'INVALID_CATEGORY');
});

test('admin edits price/stock, toggles active state, soft deletes — storefront follows', async () => {
  const created = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: { name: 'Toner Trà Xanh', sku: 'toner-green', price: 250_000, stockOnHand: 8, category: categoryId, brand: brandId },
  });
  assert.equal(created.status, 201);
  const product = created.body.data as { id: string; slug: string };

  const edit = await api('PATCH', `/api/admin/products/${product.id}`, {
    token: adminToken,
    body: { price: 240_000, stockOnHand: 15 },
  });
  assert.equal(edit.status, 200);
  assert.equal((edit.body.data as { price: number }).price, 240_000);

  const detail = await api('GET', `/api/products/${product.slug}`, {});
  assert.equal((detail.body.data as { price: number }).price, 240_000, 'storefront sees the edit');

  const deactivate = await api('PATCH', `/api/admin/products/${product.id}`, {
    token: adminToken,
    body: { isActive: false },
  });
  assert.equal(deactivate.status, 200);
  const hidden = await api('GET', `/api/products/${product.slug}`, {});
  assert.equal(hidden.status, 404, 'inactive product hidden from storefront');

  const activate = await api('PATCH', `/api/admin/products/${product.id}`, {
    token: adminToken,
    body: { isActive: true },
  });
  assert.equal(activate.status, 200);
  assert.equal((await api('GET', `/api/products/${product.slug}`, {})).status, 200);

  const del = await api('DELETE', `/api/admin/products/${product.id}`, { token: adminToken });
  assert.equal(del.status, 200);
  assert.equal((await api('GET', `/api/products/${product.slug}`, {})).status, 404);

  // Deleting frees the slug for a replacement product.
  const reuse = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: { name: 'Toner Trà Xanh', sku: 'toner-green-v2', price: 260_000, stockOnHand: 5, category: categoryId, brand: brandId },
  });
  assert.equal(reuse.status, 201, JSON.stringify(reuse.body));
  assert.equal((reuse.body.data as { slug: string }).slug, 'toner-tra-xanh');
});

test('product mutations are audited; failures are not', async () => {
  const created = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: { name: 'Audit Cream', sku: 'audit-cream', price: 100_000, stockOnHand: 3, category: categoryId, brand: brandId },
  });
  const product = created.body.data as { id: string };
  const creates = await auditEntries({ entityType: 'product', entityId: product.id, action: 'product.create' });
  assert.equal(creates.length, 1);
  assert.equal(creates[0].actor.role, 'admin');

  const before = (await auditEntries({ entityType: 'product', entityId: product.id })).length;
  await api('PATCH', `/api/admin/products/${product.id}`, { token: adminToken, body: { price: 120_000 } });
  await api('PATCH', `/api/admin/products/${product.id}`, { token: adminToken, body: { isActive: false } });
  const after = await auditEntries({ entityType: 'product', entityId: product.id });
  assert.equal(after.length, before + 2);
  const actions = after.map((entry) => entry.action);
  assert.ok(actions.includes('product.update'));
  assert.ok(actions.includes('product.status_change'));

  const failed = await api('PATCH', `/api/admin/products/${product.id}`, {
    token: adminToken,
    body: { price: -50 },
  });
  assert.equal(failed.status, 400);
  assert.equal(
    (await auditEntries({ entityType: 'product', entityId: product.id })).length,
    before + 2,
    'a failed update must not write an audit entry',
  );
});

test('employee cannot mutate products', async () => {
  const res = await api('PATCH', `/api/admin/products/${productId}`, {
    token: staffToken,
    body: { price: 1 },
  });
  assert.equal(res.status, 403);
});

test('image upload/replace/delete stores only /uploads/products paths and enforces limits', async () => {
  const created = await api('POST', '/api/admin/products', {
    token: adminToken,
    body: { name: 'Image Product', sku: 'img-prod', price: 100_000, stockOnHand: 2, category: categoryId, brand: brandId },
  });
  const product = created.body.data as { id: string };

  const uploaded = await api('POST', `/api/admin/products/${product.id}/images`, {
    token: adminToken,
    formData: pngFormData(2),
  });
  assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
  const withImages = uploaded.body.data as { images: Array<{ url: string; isPrimary: boolean }> };
  assert.equal(withImages.images.length, 2);
  assert.ok(withImages.images.every((image) => image.url.startsWith('/uploads/products/')));
  assert.equal(withImages.images[0].isPrimary, true);

  // Unsupported file type is rejected.
  const badType = new FormData();
  badType.append('images', new Blob(['nope'], { type: 'text/plain' }), 'evil.txt');
  const rejected = await api('POST', `/api/admin/products/${product.id}/images`, {
    token: adminToken,
    formData: badType,
  });
  assert.equal(rejected.status, 400);
  assert.equal(errorCode(rejected.body), 'UNSUPPORTED_FILE_TYPE');

  // Oversized file is rejected.
  const big = new FormData();
  big.append('images', new Blob([Buffer.alloc(6 * 1024 * 1024)], { type: 'image/png' }), 'big.png');
  const tooLarge = await api('POST', `/api/admin/products/${product.id}/images`, {
    token: adminToken,
    formData: big,
  });
  assert.equal(tooLarge.status, 400);
  assert.equal(errorCode(tooLarge.body), 'FILE_TOO_LARGE');

  // Exceeding the 6-image cap is rejected.
  const overCap = await api('POST', `/api/admin/products/${product.id}/images`, {
    token: adminToken,
    formData: pngFormData(5),
  });
  assert.equal(overCap.status, 400);
  assert.equal(errorCode(overCap.body), 'IMAGE_LIMIT_EXCEEDED');

  // Replace one image — URL/path metadata changes.
  const firstName = withImages.images[0].url.split('/').pop()!;
  const replaceForm = new FormData();
  replaceForm.append('image', new Blob([PNG_BYTES], { type: 'image/png' }), 'replacement.png');
  const replaced = await api('PATCH', `/api/admin/products/${product.id}/images/${firstName}`, {
    token: adminToken,
    formData: replaceForm,
  });
  assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
  const afterReplace = replaced.body.data as { images: Array<{ url: string }> };
  assert.notEqual(afterReplace.images[0].url, withImages.images[0].url);
  assert.equal(afterReplace.images.length, 2);

  // Delete an image — metadata no longer includes it.
  const secondName = afterReplace.images[1].url.split('/').pop()!;
  const deleted = await api('DELETE', `/api/admin/products/${product.id}/images/${secondName}`, {
    token: adminToken,
  });
  assert.equal(deleted.status, 200);
  const afterDelete = deleted.body.data as { images: Array<{ url: string }> };
  assert.equal(afterDelete.images.length, 1);
  assert.ok(!afterDelete.images.some((image) => image.url.endsWith(secondName)));

  const imageAudits = await auditEntries({ entityType: 'product', entityId: product.id });
  const imageActions = imageAudits.map((entry) => entry.action);
  assert.ok(imageActions.includes('product.image_add'));
  assert.ok(imageActions.includes('product.image_replace'));
  assert.ok(imageActions.includes('product.image_remove'));

  // Clean up the remaining uploaded file through the API.
  const lastName = afterDelete.images[0].url.split('/').pop()!;
  await api('DELETE', `/api/admin/products/${product.id}/images/${lastName}`, { token: adminToken });
});

// ---------- Story 5.3: categories and brands ----------

test('category and brand CRUD with delete-in-use protection and audit', async () => {
  const cat = await api('POST', '/api/admin/categories', {
    token: adminToken,
    body: { name: 'Mặt Nạ Ngủ', displayOrder: 7 },
  });
  assert.equal(cat.status, 201, JSON.stringify(cat.body));
  const category = cat.body.data as { id: string; slug: string };
  assert.equal(category.slug, 'mat-na-ngu');

  const catEdit = await api('PATCH', `/api/admin/categories/${category.id}`, {
    token: adminToken,
    body: { description: 'Mô tả mới', isActive: false },
  });
  assert.equal(catEdit.status, 200);
  assert.equal((catEdit.body.data as { isActive: boolean }).isActive, false);

  // The seeded category has products — deletion must be rejected.
  const blockedDelete = await api('DELETE', `/api/admin/categories/${categoryId}`, {
    token: adminToken,
  });
  assert.equal(blockedDelete.status, 409);
  assert.equal(errorCode(blockedDelete.body), 'CATEGORY_IN_USE');

  const blockedBrand = await api('DELETE', `/api/admin/brands/${brandId}`, { token: adminToken });
  assert.equal(blockedBrand.status, 409);
  assert.equal(errorCode(blockedBrand.body), 'BRAND_IN_USE');

  // Unreferenced records delete cleanly.
  const brand = await api('POST', '/api/admin/brands', {
    token: adminToken,
    body: { name: 'Some By Me Test', country: 'KR' },
  });
  assert.equal(brand.status, 201);
  const brandDoc = brand.body.data as { id: string };
  const delBrand = await api('DELETE', `/api/admin/brands/${brandDoc.id}`, { token: adminToken });
  assert.equal(delBrand.status, 200);

  const delCat = await api('DELETE', `/api/admin/categories/${category.id}`, { token: adminToken });
  assert.equal(delCat.status, 200);

  const audits = await auditEntries({ entityType: 'category', entityId: category.id });
  const actions = audits.map((entry) => entry.action);
  assert.ok(actions.includes('category.create'));
  assert.ok(actions.includes('category.update'));
  assert.ok(actions.includes('category.status_change'));
  assert.ok(actions.includes('category.delete'));

  const brandAudits = await auditEntries({ entityType: 'brand', entityId: brandDoc.id });
  assert.ok(brandAudits.some((entry) => entry.action === 'brand.delete'));

  // Public storefront keeps serving active taxonomies only.
  const publicCats = await api('GET', '/api/categories', {});
  const slugs = (publicCats.body.data as Array<{ slug: string }>).map((c) => c.slug);
  assert.ok(slugs.includes('test-category'));
  assert.ok(!slugs.includes('mat-na-ngu'));
});

// ---------- Story 5.4: customers ----------

test('customer list supports search and pagination', async () => {
  const list = await api('GET', '/api/admin/customers', { token: adminToken });
  assert.equal(list.status, 200);
  const items = list.body.data as Array<{ id: string; email: string }>;
  assert.ok(items.length >= 2);
  assert.ok((list.body.meta as { total: number }).total >= 2);

  const byEmail = await api('GET', '/api/admin/customers?q=cust2@', { token: adminToken });
  const emails = (byEmail.body.data as Array<{ email: string }>).map((c) => c.email);
  assert.deepEqual(emails, ['cust2@test.dev']);

  const byPhone = await api('GET', '/api/admin/customers?q=0912000111', { token: adminToken });
  assert.equal((byPhone.body.data as Array<{ id: string }>)[0].id, customerId);

  const byName = await api('GET', '/api/admin/customers?q=Khách Hai', { token: adminToken });
  assert.equal((byName.body.data as Array<{ id: string }>)[0].id, customer2Id);

  const page = await api('GET', '/api/admin/customers?limit=1&page=2', { token: adminToken });
  assert.equal((page.body.data as unknown[]).length, 1);
});

test('customer profile includes order history; blocking removes API access, unblocking restores', async () => {
  // cust2 places an order first.
  const cust2Token = await login('cust2@test.dev');
  const add = await api('POST', '/api/cart/items', { token: cust2Token, body: { productId, qty: 1 } });
  assert.equal(add.status, 201);
  const checkout = await api('POST', '/api/orders', {
    token: cust2Token,
    body: { paymentMethod: 'cod', shipping: SHIPPING },
  });
  assert.equal(checkout.status, 201);
  const orderNo = (checkout.body.data as { orderNo: string }).orderNo;

  const profile = await api('GET', `/api/admin/customers/${customer2Id}`, { token: adminToken });
  assert.equal(profile.status, 200);
  const detail = profile.body.data as {
    customer: { email: string };
    orders: Array<{ orderNo: string }>;
  };
  assert.equal(detail.customer.email, 'cust2@test.dev');
  assert.ok(detail.orders.some((order) => order.orderNo === orderNo));

  // Block — login and a previously issued token must both fail.
  const block = await api('PATCH', `/api/admin/customers/${customer2Id}/status`, {
    token: adminToken,
    body: { status: 'blocked', note: 'Giả lập gian lận' },
  });
  assert.equal(block.status, 200);
  assert.equal((block.body.data as { status: string }).status, 'blocked');

  assert.equal(await loginExpectFailure('cust2@test.dev'), 403);
  const blockedCall = await api('GET', '/api/orders', { token: cust2Token });
  assert.equal(blockedCall.status, 401);
  assert.equal(errorCode(blockedCall.body), 'ACCOUNT_BLOCKED');

  const audits = await auditEntries({ entityType: 'user', entityId: customer2Id });
  const statusChanges = audits.filter((entry) => entry.action === 'customer.status_change');
  assert.equal(statusChanges.length, 1);
  assert.deepEqual(statusChanges[0].previousValue, { status: 'active' });
  assert.deepEqual(statusChanges[0].nextValue, { status: 'blocked' });
  assert.equal(statusChanges[0].note, 'Giả lập gian lận');

  // Unblock restores login and API access.
  const unblock = await api('PATCH', `/api/admin/customers/${customer2Id}/status`, {
    token: adminToken,
    body: { status: 'active' },
  });
  assert.equal(unblock.status, 200);
  const newToken = await login('cust2@test.dev');
  assert.equal((await api('GET', '/api/orders', { token: newToken })).status, 200);
});

test('staff accounts are not manageable through the customer surface', async () => {
  const res = await api('PATCH', `/api/admin/customers/${staffUserId}/status`, {
    token: adminToken,
    body: { status: 'blocked' },
  });
  assert.equal(res.status, 404);
});

// ---------- Story 5.5: staff ----------

test('admin creates employee and admin staff; created accounts can log in with their role', async () => {
  const emp = await api('POST', '/api/admin/staff', {
    token: adminToken,
    body: { email: 'new-emp@test.dev', password: PASSWORD, fullName: 'Nhân Viên Mới', role: 'employee' },
  });
  assert.equal(emp.status, 201, JSON.stringify(emp.body));
  const empUser = emp.body.data as { id: string; roles: string[] };
  assert.deepEqual(empUser.roles, ['employee']);

  const empToken = await login('new-emp@test.dev');
  assert.equal((await api('GET', '/api/employee/orders', { token: empToken })).status, 200);
  assert.equal((await api('GET', '/api/admin/dashboard', { token: empToken })).status, 403);

  const adm = await api('POST', '/api/admin/staff', {
    token: adminToken,
    body: { email: 'new-admin@test.dev', password: PASSWORD, fullName: 'Quản Trị Mới', role: 'admin' },
  });
  assert.equal(adm.status, 201);
  const admToken = await login('new-admin@test.dev');
  assert.equal((await api('GET', '/api/admin/dashboard', { token: admToken })).status, 200);

  const dup = await api('POST', '/api/admin/staff', {
    token: adminToken,
    body: { email: 'new-emp@test.dev', password: PASSWORD, fullName: 'Dup', role: 'employee' },
  });
  assert.equal(dup.status, 409);

  const weak = await api('POST', '/api/admin/staff', {
    token: adminToken,
    body: { email: 'weak@test.dev', password: 'short', fullName: 'Weak', role: 'employee' },
  });
  assert.equal(weak.status, 400);

  const badRole = await api('POST', '/api/admin/staff', {
    token: adminToken,
    body: { email: 'cust-role@test.dev', password: PASSWORD, fullName: 'Bad Role', role: 'customer' },
  });
  assert.equal(badRole.status, 400);
});

test('admin cannot deactivate their own account; other admins can be deactivated', async () => {
  const self = await api('PATCH', `/api/admin/staff/${adminUserId}/status`, {
    token: adminToken,
    body: { status: 'inactive' },
  });
  assert.equal(self.status, 409);
  assert.equal(errorCode(self.body), 'CANNOT_DEACTIVATE_SELF');

  const selfRole = await api('PATCH', `/api/admin/staff/${adminUserId}/role`, {
    token: adminToken,
    body: { role: 'employee' },
  });
  assert.equal(selfRole.status, 409);
  assert.equal(errorCode(selfRole.body), 'CANNOT_CHANGE_OWN_ROLE');

  const other = await api('PATCH', `/api/admin/staff/${admin2UserId}/status`, {
    token: adminToken,
    body: { status: 'inactive' },
  });
  assert.equal(other.status, 200);

  // A deactivated staff account loses API access immediately.
  const admin2Token = await loginExpectFailure('admin2@test.dev');
  assert.equal(admin2Token, 403);

  const audits = await auditEntries({ entityType: 'user', entityId: admin2UserId });
  const entry = audits.find((item) => item.action === 'staff.status_change');
  assert.ok(entry, 'staff status change audited');
  assert.deepEqual(entry!.previousValue, { roles: ['admin'], status: 'active' });
  assert.deepEqual(entry!.nextValue, { roles: ['admin'], status: 'inactive' });
});

test('staff role change is applied and audited', async () => {
  const created = await api('POST', '/api/admin/staff', {
    token: adminToken,
    body: { email: 'promote-me@test.dev', password: PASSWORD, fullName: 'Sắp Thăng', role: 'employee' },
  });
  const member = created.body.data as { id: string };

  const promoted = await api('PATCH', `/api/admin/staff/${member.id}/role`, {
    token: adminToken,
    body: { role: 'admin' },
  });
  assert.equal(promoted.status, 200);
  assert.deepEqual((promoted.body.data as { roles: string[] }).roles, ['admin']);

  const promotedToken = await login('promote-me@test.dev');
  assert.equal((await api('GET', '/api/admin/dashboard', { token: promotedToken })).status, 200);

  const audits = await auditEntries({ entityType: 'user', entityId: member.id });
  const roleChange = audits.find((entry) => entry.action === 'staff.role_change');
  assert.ok(roleChange);
  assert.deepEqual(roleChange!.previousValue, { roles: ['employee'], status: 'active' });
  assert.deepEqual(roleChange!.nextValue, { roles: ['admin'], status: 'active' });
});

test('employee cannot reach staff management', async () => {
  const res = await api('GET', '/api/admin/staff', { token: staffToken });
  assert.equal(res.status, 403);
  const create = await api('POST', '/api/admin/staff', {
    token: staffToken,
    body: { email: 'x@test.dev', password: PASSWORD, fullName: 'X Y', role: 'admin' },
  });
  assert.equal(create.status, 403);
});

// ---------- Story 5.6: admin orders reuse the shared workflow ----------

test('admin runs the full order workflow with exactly-once inventory', async () => {
  const order = await createOrderViaApi(2);
  const before = (await productDoc())!;

  const list = await api('GET', '/api/admin/orders', { token: adminToken });
  assert.equal(list.status, 200);
  assert.ok((list.body.data as Array<{ orderNo: string }>).some((o) => o.orderNo === order.orderNo));

  const detail = await api('GET', `/api/admin/orders/${order.orderNo}`, { token: adminToken });
  assert.equal(detail.status, 200);
  assert.equal((detail.body.data as { inventoryState: string }).inventoryState, 'reserved');

  for (const [from, to] of [
    ['pending', 'processing'],
    ['processing', 'shipped'],
    ['shipped', 'delivered'],
  ] as const) {
    const res = await api('PATCH', `/api/admin/orders/${order.orderNo}/status`, {
      token: adminToken,
      body: { status: to },
    });
    assert.equal(res.status, 200, `${from} -> ${to}: ${JSON.stringify(res.body)}`);
  }

  const after = (await productDoc())!;
  assert.equal(after.stockOnHand, before.stockOnHand - 2, 'shipment deducted exactly once');
  assert.equal(after.stockReserved, before.stockReserved - 2);

  const { OrderModel } = await import('../../models/Order.js');
  const doc = await OrderModel.findById(order.id).exec();
  assert.equal(doc!.inventoryState, 'deducted');
  assert.equal(doc!.orderStatus, 'delivered');
});

test('admin order cancellation releases the reservation; backward moves rejected', async () => {
  const order = await createOrderViaApi(1);
  const backward = await api('PATCH', `/api/admin/orders/${order.orderNo}/status`, {
    token: adminToken,
    body: { status: 'delivered' },
  });
  assert.equal(backward.status, 400);
  assert.equal(errorCode(backward.body), 'INVALID_STATUS_TRANSITION');

  const cancelled = await api('PATCH', `/api/admin/orders/${order.orderNo}/status`, {
    token: adminToken,
    body: { status: 'cancelled', reason: 'Hủy theo yêu cầu' },
  });
  assert.equal(cancelled.status, 200);
  const { OrderModel } = await import('../../models/Order.js');
  const doc = await OrderModel.findById(order.id).exec();
  assert.equal(doc!.inventoryState, 'released');
});

test('admin manual payment updates set/clear paidAt and are audited', async () => {
  const order = await createOrderViaApi(1);

  const paid = await api('PATCH', `/api/admin/orders/${order.orderNo}/payment`, {
    token: adminToken,
    body: { paymentStatus: 'paid', note: 'Đã nhận chuyển khoản' },
  });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  const paidData = paid.body.data as { paymentStatus: string; paidAt: string | null };
  assert.equal(paidData.paymentStatus, 'paid');
  assert.notEqual(paidData.paidAt, null);

  const unpaid = await api('PATCH', `/api/admin/orders/${order.orderNo}/payment`, {
    token: adminToken,
    body: { paymentStatus: 'unpaid' },
  });
  assert.equal(unpaid.status, 200);
  const unpaidData = unpaid.body.data as { paymentStatus: string; paidAt: string | null };
  assert.equal(unpaidData.paymentStatus, 'unpaid');
  assert.equal(unpaidData.paidAt, null);

  const audits = await auditEntries({ entityType: 'order', entityId: order.id });
  const paymentAudits = audits.filter((entry) => entry.action === 'order.payment_status_change');
  assert.equal(paymentAudits.length, 2);
  assert.equal(paymentAudits[0].actor.role, 'admin');
  assert.equal(paymentAudits[1].note, 'Đã nhận chuyển khoản');
});

// ---------- Audit log surface ----------

test('admin can page through audit logs; other roles cannot', async () => {
  const res = await api('GET', '/api/admin/audit-logs?limit=5', { token: adminToken });
  assert.equal(res.status, 200);
  const items = res.body.data as Array<{ action: string; entityType: string }>;
  assert.ok(items.length > 0);
  assert.ok((res.body.meta as { total: number }).total >= items.length);

  const filtered = await api('GET', '/api/admin/audit-logs?entityType=product', {
    token: adminToken,
  });
  assert.ok(
    (filtered.body.data as Array<{ entityType: string }>).every(
      (entry) => entry.entityType === 'product',
    ),
  );

  assert.equal((await api('GET', '/api/admin/audit-logs', { token: staffToken })).status, 403);
});
