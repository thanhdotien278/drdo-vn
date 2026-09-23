import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Stories 7.3/7.4 integration checks — purchase-gated review submission,
 * ownership rules, shared employee/admin moderation, audit evidence, and
 * approved-only rating aggregation against a real MongoDB test database.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI_REVIEWS ?? 'mongodb://127.0.0.1:27017/drdo_vn_test_reviews';

let server: Server;
let baseUrl: string;

const PASSWORD = 'Password123!';

async function api(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  return (body.error as { code?: string } | undefined)?.code;
}

async function login(email: string): Promise<string> {
  const res = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(res.status, 200, `login ${email} failed: ${JSON.stringify(res.body)}`);
  return (res.body.data as { token: string }).token;
}

const SHIPPING = {
  fullName: 'Nguyễn Thị Kho',
  phone: '0912345678',
  line1: '12 Đường Test',
  ward: 'Phường Test',
  district: 'Quận Test',
  province: 'TP. Hồ Chí Minh',
};

interface ReviewBody {
  id: string;
  rating: number;
  comment: string;
  status: string;
  authorName: string;
}

let customerToken = '';
let customer2Token = '';
let employeeToken = '';
let adminToken = '';
let productId = '';
let product2Id = '';
let productSlug = '';
let reviewId = '';
let review2Id = '';

async function buyProduct(token: string, pid: string, qty = 1): Promise<string> {
  const add = await api('POST', '/api/cart/items', { token, body: { productId: pid, qty } });
  assert.equal(add.status, 201, `add to cart failed: ${JSON.stringify(add.body)}`);
  const res = await api('POST', '/api/orders', {
    token,
    body: { paymentMethod: 'cod', shipping: SHIPPING },
  });
  assert.equal(res.status, 201, `checkout failed: ${JSON.stringify(res.body)}`);
  return (res.body.data as { orderNo: string }).orderNo;
}

async function productRating(pid: string): Promise<{ ratingAverage: number; ratingCount: number }> {
  const { ProductModel } = await import('../../models/Product.js');
  const doc = await ProductModel.findById(pid).select('ratingAverage ratingCount').exec();
  return { ratingAverage: doc?.ratingAverage ?? 0, ratingCount: doc?.ratingCount ?? 0 };
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
  const { OrderModel } = await import('../../models/Order.js');
  const { OrderItemModel } = await import('../../models/OrderItem.js');
  const { OrderStatusEventModel } = await import('../../models/OrderStatusEvent.js');
  const { ReviewModel } = await import('../../models/Review.js');
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  const { hashPassword } = await import('../auth/password.js');

  await connectDatabase(TEST_MONGO_URI);
  await Promise.all([
    UserModel.deleteMany({}),
    CartModel.deleteMany({}),
    CartItemModel.deleteMany({}),
    OrderModel.deleteMany({}),
    OrderItemModel.deleteMany({}),
    OrderStatusEventModel.deleteMany({}),
    ReviewModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
    ProductModel.deleteMany({}),
    BrandModel.deleteMany({}),
    CategoryModel.deleteMany({}),
  ]);

  const passwordHash = await hashPassword(PASSWORD);
  await UserModel.create([
    { email: 'cust@test.dev', passwordHash, fullName: 'Khách Một', roles: ['customer'], status: 'active' },
    { email: 'cust2@test.dev', passwordHash, fullName: 'Khách Hai', roles: ['customer'], status: 'active' },
    { email: 'staff@test.dev', passwordHash, fullName: 'Nhân Viên', roles: ['employee'], status: 'active' },
    { email: 'admin@test.dev', passwordHash, fullName: 'Quản Trị', roles: ['admin'], status: 'active' },
  ]);

  const brand = await BrandModel.create({ name: 'Test Brand', slug: 'test-brand' });
  const category = await CategoryModel.create({ name: 'Test Category', slug: 'test-category' });

  const product = await ProductModel.create({
    name: 'Serum Review',
    slug: 'serum-review',
    sku: 'RV-SERUM',
    price: 200_000,
    stockOnHand: 30,
    category: category._id,
    brand: brand._id,
    isActive: true,
  });
  productId = String(product._id);
  productSlug = product.slug;

  const product2 = await ProductModel.create({
    name: 'Toner Review',
    slug: 'toner-review',
    sku: 'RV-TONER',
    price: 150_000,
    stockOnHand: 30,
    category: category._id,
    brand: brand._id,
    isActive: true,
  });
  product2Id = String(product2._id);

  server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  customerToken = await login('cust@test.dev');
  customer2Token = await login('cust2@test.dev');
  employeeToken = await login('staff@test.dev');
  adminToken = await login('admin@test.dev');
});

after(async () => {
  const { disconnectDatabase } = await import('../../db/connect.js');
  server.close();
  await disconnectDatabase();
});

// ---------- RBAC ----------

test('anonymous and staff roles are rejected on customer review routes', async () => {
  assert.equal((await api('POST', `/api/products/${productId}/reviews`, { body: { rating: 5 } })).status, 401);
  assert.equal((await api('GET', `/api/products/${productId}/reviews/me`, {})).status, 401);
  assert.equal(
    (await api('PATCH', '/api/reviews/000000000000000000000000', { body: { rating: 4 } })).status,
    401,
  );
  for (const token of [employeeToken, adminToken]) {
    const res = await api('POST', `/api/products/${productId}/reviews`, {
      token,
      body: { rating: 5 },
    });
    assert.equal(res.status, 403, 'staff roles cannot create customer reviews');
  }
});

test('customers get 403 on moderation routes; anonymous gets 401', async () => {
  assert.equal((await api('GET', '/api/employee/reviews', { token: customerToken })).status, 403);
  assert.equal((await api('GET', '/api/admin/reviews', { token: customerToken })).status, 403);
  assert.equal((await api('GET', '/api/employee/reviews', {})).status, 401);
  assert.equal((await api('GET', '/api/admin/reviews', {})).status, 401);
});

// ---------- Story 7.3: eligibility + ownership ----------

test('a customer without a qualifying order cannot review', async () => {
  const res = await api('POST', `/api/products/${productId}/reviews`, {
    token: customer2Token,
    body: { rating: 5, comment: 'Chưa mua' },
  });
  assert.equal(res.status, 403);
  assert.equal(errorCode(res.body), 'REVIEW_NOT_ELIGIBLE');
});

test('a customer whose only order was cancelled cannot review', async () => {
  const orderNo = await buyProduct(customer2Token, product2Id);
  const cancel = await api('PATCH', `/api/employee/orders/${orderNo}/status`, {
    token: employeeToken,
    body: { status: 'cancelled', note: 'Khách hủy' },
  });
  assert.equal(cancel.status, 200, JSON.stringify(cancel.body));

  const res = await api('POST', `/api/products/${product2Id}/reviews`, {
    token: customer2Token,
    body: { rating: 4 },
  });
  assert.equal(res.status, 403);
  assert.equal(errorCode(res.body), 'REVIEW_NOT_ELIGIBLE');
});

test('buyer creates a pending review; invalid ratings are rejected', async () => {
  await buyProduct(customerToken, productId);

  for (const rating of [0, 6, 2.5, 'five']) {
    const res = await api('POST', `/api/products/${productId}/reviews`, {
      token: customerToken,
      body: { rating },
    });
    assert.equal(res.status, 400, `rating ${rating} must be rejected`);
  }

  const res = await api('POST', `/api/products/${productId}/reviews`, {
    token: customerToken,
    body: { rating: 5, comment: 'Rất thích!' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const review = res.body.data as ReviewBody;
  assert.equal(review.status, 'pending');
  assert.equal(review.rating, 5);
  reviewId = review.id;
});

test('a pending review is not publicly visible and does not affect ratings', async () => {
  const list = await api('GET', `/api/products/${productId}/reviews`, {});
  assert.equal(list.status, 200);
  assert.equal((list.body.data as ReviewBody[]).length, 0);

  const detail = await api('GET', `/api/products/${productSlug}`, {});
  const data = detail.body.data as { ratingAverage: number; ratingCount: number };
  assert.equal(data.ratingCount, 0);
  assert.equal(data.ratingAverage, 0);
});

test('one review per customer per product is enforced', async () => {
  const res = await api('POST', `/api/products/${productId}/reviews`, {
    token: customerToken,
    body: { rating: 4 },
  });
  assert.equal(res.status, 409);
  assert.equal(errorCode(res.body), 'REVIEW_EXISTS');
});

test('me endpoint reports the own review and eligibility', async () => {
  const res = await api('GET', `/api/products/${productId}/reviews/me`, { token: customerToken });
  assert.equal(res.status, 200);
  const data = res.body.data as { review: ReviewBody | null; eligible: boolean };
  assert.equal(data.review?.id, reviewId);
  assert.equal(data.eligible, true);

  const other = await api('GET', `/api/products/${product2Id}/reviews/me`, { token: customerToken });
  assert.deepEqual(other.body.data, { review: null, eligible: false });
});

// ---------- Story 7.4: moderation + aggregation ----------

test('employee sees the pending queue and approves the review', async () => {
  const queue = await api('GET', '/api/employee/reviews?status=pending', { token: employeeToken });
  assert.equal(queue.status, 200);
  const items = queue.body.data as Array<ReviewBody & { customer: { email: string } | null }>;
  const pending = items.find((item) => item.id === reviewId);
  assert.ok(pending, 'pending review must appear in the moderation queue');
  assert.equal(pending!.customer?.email, 'cust@test.dev');

  const approve = await api('PATCH', `/api/employee/reviews/${reviewId}/status`, {
    token: employeeToken,
    body: { status: 'approved', note: 'Nội dung ổn' },
  });
  assert.equal(approve.status, 200, JSON.stringify(approve.body));
  assert.equal((approve.body.data as ReviewBody).status, 'approved');

  const list = await api('GET', `/api/products/${productId}/reviews`, {});
  const publicItems = list.body.data as ReviewBody[];
  assert.equal(publicItems.length, 1);
  assert.equal(publicItems[0].authorName, 'Khách Một');

  const rating = await productRating(productId);
  assert.deepEqual(rating, { ratingAverage: 5, ratingCount: 1 });

  const audits = await auditEntries({ entityType: 'review', entityId: reviewId });
  const change = audits.find((entry) => entry.action === 'review.status_change');
  assert.ok(change, 'moderation must be audited');
  assert.equal(change!.actor.role, 'employee');
  assert.deepEqual(change!.previousValue, { status: 'pending' });
  assert.deepEqual(change!.nextValue, { status: 'approved' });
  assert.equal(change!.note, 'Nội dung ổn');
});

test('editing an approved review returns it to pending and out of the aggregate', async () => {
  const edit = await api('PATCH', `/api/reviews/${reviewId}`, {
    token: customerToken,
    body: { rating: 4, comment: 'Sửa lại: vẫn tốt nhưng hơi đắt' },
  });
  assert.equal(edit.status, 200);
  assert.equal((edit.body.data as ReviewBody).status, 'pending');
  assert.equal((edit.body.data as ReviewBody).rating, 4);

  const list = await api('GET', `/api/products/${productId}/reviews`, {});
  assert.equal((list.body.data as ReviewBody[]).length, 0, 'edited review leaves public view');
  assert.deepEqual(await productRating(productId), { ratingAverage: 0, ratingCount: 0 });
});

test('a customer cannot edit or delete another customer review', async () => {
  await buyProduct(customer2Token, product2Id);
  const created = await api('POST', `/api/products/${product2Id}/reviews`, {
    token: customer2Token,
    body: { rating: 2, comment: 'Hơi chát' },
  });
  assert.equal(created.status, 201);
  review2Id = (created.body.data as ReviewBody).id;

  const edit = await api('PATCH', `/api/reviews/${review2Id}`, {
    token: customerToken,
    body: { rating: 5 },
  });
  assert.equal(edit.status, 404);

  const del = await api('DELETE', `/api/reviews/${review2Id}`, { token: customerToken });
  assert.equal(del.status, 404);
});

test('admin approves the second review; approved-only aggregation is correct', async () => {
  const approve = await api('PATCH', `/api/admin/reviews/${review2Id}/status`, {
    token: adminToken,
    body: { status: 'approved' },
  });
  assert.equal(approve.status, 200);

  // Re-approve the edited first review (rating 4) through the admin queue.
  const reapprove = await api('PATCH', `/api/admin/reviews/${reviewId}/status`, {
    token: adminToken,
    body: { status: 'approved' },
  });
  assert.equal(reapprove.status, 200);

  // Second customer buys the same product and adds a 3-star review.
  await buyProduct(customer2Token, productId);
  const created = await api('POST', `/api/products/${productId}/reviews`, {
    token: customer2Token,
    body: { rating: 3, comment: 'Tạm ổn' },
  });
  assert.equal(created.status, 201);
  const review3Id = (created.body.data as ReviewBody).id;
  const approve3 = await api('PATCH', `/api/employee/reviews/${review3Id}/status`, {
    token: employeeToken,
    body: { status: 'approved' },
  });
  assert.equal(approve3.status, 200);

  // Product 1: approved ratings 4 + 3 → average 3.5, count 2.
  const rating = await productRating(productId);
  assert.deepEqual(rating, { ratingAverage: 3.5, ratingCount: 2 });

  const detail = await api('GET', `/api/products/${productSlug}`, {});
  const data = detail.body.data as { ratingAverage: number; ratingCount: number };
  assert.equal(data.ratingAverage, 3.5);
  assert.equal(data.ratingCount, 2);

  const list = await api('GET', '/api/products?q=serum-review', {});
  const item = (list.body.data as Array<{ id: string; ratingAverage: number; ratingCount: number }>).find(
    (entry) => entry.id === productId,
  );
  assert.equal(item?.ratingAverage, 3.5);
  assert.equal(item?.ratingCount, 2);

  // Product 2 aggregate is independent (rating 2, count 1).
  assert.deepEqual(await productRating(product2Id), { ratingAverage: 2, ratingCount: 1 });
});

test('rejecting an approved review removes it from the aggregate; deletion recomputes too', async () => {
  const reject = await api('PATCH', `/api/admin/reviews/${review2Id}/status`, {
    token: adminToken,
    body: { status: 'rejected', note: 'Ngôn từ chưa phù hợp' },
  });
  assert.equal(reject.status, 200);
  assert.deepEqual(await productRating(product2Id), { ratingAverage: 0, ratingCount: 0 });

  const audits = await auditEntries({ entityType: 'review', entityId: review2Id });
  const rejection = audits.find(
    (entry) => entry.action === 'review.status_change' && entry.actor.role === 'admin',
  );
  assert.ok(rejection);
  assert.deepEqual(rejection!.previousValue, { status: 'approved' });
  assert.deepEqual(rejection!.nextValue, { status: 'rejected' });
  assert.equal(rejection!.note, 'Ngôn từ chưa phù hợp');

  // Staff deletion removes the review entirely and keeps the aggregate honest.
  const before = (await auditEntries({ entityType: 'review', entityId: review2Id })).length;
  const del = await api('DELETE', `/api/employee/reviews/${review2Id}`, { token: employeeToken });
  assert.equal(del.status, 200);
  const delAudit = (await auditEntries({ entityType: 'review', entityId: review2Id })).find(
    (entry) => entry.action === 'review.delete',
  );
  assert.ok(delAudit, 'staff delete must be audited');
  assert.equal((await auditEntries({ entityType: 'review', entityId: review2Id })).length, before + 1);
});

test('failed moderation attempts write no audit rows', async () => {
  const before = (await auditEntries({ entityType: 'review' })).length;
  const bad = await api('PATCH', `/api/admin/reviews/${reviewId}/status`, {
    token: adminToken,
    body: { status: 'pending' },
  });
  assert.equal(bad.status, 400, 'staff cannot force a review back to pending');
  const missing = await api('PATCH', '/api/admin/reviews/000000000000000000000000/status', {
    token: adminToken,
    body: { status: 'approved' },
  });
  assert.equal(missing.status, 404);
  assert.equal((await auditEntries({ entityType: 'review' })).length, before);
});

test('customer deletes their own review and the aggregate drops it', async () => {
  const del = await api('DELETE', `/api/reviews/${reviewId}`, { token: customerToken });
  assert.equal(del.status, 200);
  // Only the other approved 3-star review remains on product 1.
  assert.deepEqual(await productRating(productId), { ratingAverage: 3, ratingCount: 1 });
});
