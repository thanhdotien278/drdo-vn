import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Epic 4 integration checks — employee order list/detail, the shared status
 * transition service, shipment deduction/cancellation release, manual payment
 * updates, and audit/timeline evidence against a real MongoDB test database.
 * Uses a dedicated database so it can run alongside the Epic 3 suite.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI = process.env.MONGODB_TEST_URI_EPIC4 ?? 'mongodb://127.0.0.1:27017/drdo_vn_test_epic4';

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

let productId = '';
const PRODUCT_STOCK = 20;
let customerToken = '';
let staffToken = '';
let adminToken = '';

async function createOrder(qty = 2): Promise<{ id: string; orderNo: string }> {
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

async function setStatus(orderNo: string, status: string, extra: Record<string, unknown> = {}) {
  return api('PATCH', `/api/employee/orders/${orderNo}/status`, {
    token: staffToken,
    body: { status, ...extra },
  });
}

async function setPayment(orderNo: string, paymentStatus: string, token = staffToken) {
  return api('PATCH', `/api/employee/orders/${orderNo}/payment`, {
    token,
    body: { paymentStatus },
  });
}

async function product() {
  const { ProductModel } = await import('../../models/Product.js');
  return ProductModel.findById(productId).exec();
}

async function auditCount(orderId: string, action?: string): Promise<number> {
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  const filter: Record<string, unknown> = { entityType: 'order', entityId: orderId };
  if (action) filter.action = action;
  return AuditLogModel.countDocuments(filter).exec();
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
  await UserModel.create({
    email: 'cust@test.dev',
    passwordHash,
    fullName: 'Test Customer',
    roles: ['customer'],
    status: 'active',
  });
  await UserModel.create({
    email: 'staff@test.dev',
    passwordHash,
    fullName: 'Test Staff',
    roles: ['employee'],
    status: 'active',
  });
  await UserModel.create({
    email: 'admin@test.dev',
    passwordHash,
    fullName: 'Test Admin',
    roles: ['admin'],
    status: 'active',
  });

  const brand = await BrandModel.create({ name: 'Test Brand', slug: 'test-brand' });
  const category = await CategoryModel.create({ name: 'Test Category', slug: 'test-category' });
  const productDoc = await ProductModel.create({
    name: 'Test Serum',
    slug: 'test-serum',
    sku: 'TST-SERUM',
    price: 350_000,
    stockOnHand: PRODUCT_STOCK,
    category: category._id,
    brand: brand._id,
    isActive: true,
  });
  productId = String(productDoc._id);

  server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  customerToken = await login('cust@test.dev');
  staffToken = await login('staff@test.dev');
  adminToken = await login('admin@test.dev');
});

after(async () => {
  const { disconnectDatabase } = await import('../../db/connect.js');
  server.close();
  await disconnectDatabase();
});

// ---------- Story 4.1: RBAC + list/detail ----------

test('anonymous requests to employee order APIs return 401', async () => {
  for (const [method, path] of [
    ['GET', '/api/employee/orders'],
    ['GET', '/api/employee/orders/DRD-X'],
    ['PATCH', '/api/employee/orders/DRD-X/status'],
    ['PATCH', '/api/employee/orders/DRD-X/payment'],
  ] as const) {
    const res = await api(method, path, method === 'GET' ? {} : { body: {} });
    assert.equal(res.status, 401, `${method} ${path} should reject anonymous requests`);
  }
});

test('customer and admin tokens are rejected by employee order APIs (403)', async () => {
  for (const token of [customerToken, adminToken]) {
    for (const [method, path] of [
      ['GET', '/api/employee/orders'],
      ['GET', '/api/employee/orders/DRD-X'],
      ['PATCH', '/api/employee/orders/DRD-X/status'],
      ['PATCH', '/api/employee/orders/DRD-X/payment'],
    ] as const) {
      const res = await api(method, path, method === 'GET' ? { token } : { token, body: {} });
      assert.equal(res.status, 403, `${method} ${path} should reject non-employee roles`);
    }
  }
});

test('employee cannot reach admin-only surfaces (403)', async () => {
  const res = await api('GET', '/api/admin/rbac-smoke', { token: staffToken });
  assert.equal(res.status, 403);
});

test('employee lists all orders with status filter and opens fulfillment detail', async () => {
  const first = await createOrder(2);
  const second = await createOrder(1);

  const list = await api('GET', '/api/employee/orders', { token: staffToken });
  assert.equal(list.status, 200);
  const items = list.body.data as Array<{ orderNo: string; customerName: string }>;
  assert.ok(items.length >= 2);
  const meta = list.body.meta as { total: number; page: number };
  assert.ok(meta.total >= 2);

  const pendingOnly = await api('GET', '/api/employee/orders?status=pending', { token: staffToken });
  const pendingItems = pendingOnly.body.data as Array<{ orderStatus: string }>;
  assert.ok(pendingItems.length >= 2);
  assert.ok(pendingItems.every((order) => order.orderStatus === 'pending'));

  const cancelledOnly = await api('GET', '/api/employee/orders?status=cancelled', {
    token: staffToken,
  });
  assert.equal((cancelledOnly.body.data as unknown[]).length, 0);

  const detail = await api('GET', `/api/employee/orders/${first.orderNo}`, { token: staffToken });
  assert.equal(detail.status, 200);
  const order = detail.body.data as {
    orderNo: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod: string;
    items: unknown[];
    totals: { grandTotal: number; shippingFee: number };
    shipping: Record<string, string>;
    timeline: Array<{ toStatus: string }>;
    customer: { email: string; fullName: string };
    inventoryState: string;
  };
  assert.equal(order.orderNo, first.orderNo);
  assert.equal(order.shipping.fullName, SHIPPING.fullName);
  assert.equal(order.customer.email, 'cust@test.dev');
  assert.equal(order.items.length, 1);
  assert.equal(order.totals.grandTotal, 350_000 * 2 + 30_000);
  assert.equal(order.timeline[0].toStatus, 'pending');
  assert.equal(order.inventoryState, 'reserved');

  const missing = await api('GET', '/api/employee/orders/DRD-NOPE', { token: staffToken });
  assert.equal(missing.status, 404);

  // Keep `second` pending for later tests; `first` is used below.
  void second;
});

// ---------- Story 4.2/4.3: transitions + inventory ----------

test('pending -> processing -> shipped -> delivered consumes inventory exactly once', async () => {
  const order = await createOrder(2);
  const { OrderModel } = await import('../../models/Order.js');

  const before = (await product())!;
  assert.equal(before.stockReserved > 0, true, 'checkout reservation must exist before shipment');
  const reservedBefore = before.stockReserved;
  const onHandBefore = before.stockOnHand;

  const toProcessing = await setStatus(order.orderNo, 'processing', { reason: 'Xác nhận đơn' });
  assert.equal(toProcessing.status, 200, JSON.stringify(toProcessing.body));
  const mid = (await product())!;
  assert.equal(mid.stockOnHand, onHandBefore, 'processing must not deduct stock on hand');
  assert.equal(mid.stockReserved, reservedBefore);

  const toShipped = await setStatus(order.orderNo, 'shipped');
  assert.equal(toShipped.status, 200, JSON.stringify(toShipped.body));
  const shipped = (await product())!;
  assert.equal(shipped.stockOnHand, onHandBefore - 2, 'shipment deducts stock on hand');
  assert.equal(shipped.stockReserved, reservedBefore - 2, 'shipment consumes the reservation');
  assert.equal(shipped.availableStock, shipped.stockOnHand - shipped.stockReserved);
  const doc = await OrderModel.findById(order.id).exec();
  assert.equal(doc!.inventoryState, 'deducted', 'reservation is marked consumed');

  // Replaying shipment is rejected before touching inventory — no double deduct.
  const replay = await setStatus(order.orderNo, 'shipped');
  assert.equal(replay.status, 400);
  assert.equal(errorCode(replay.body), 'INVALID_STATUS_TRANSITION');
  const afterReplay = (await product())!;
  assert.equal(afterReplay.stockOnHand, shipped.stockOnHand);
  assert.equal(afterReplay.stockReserved, shipped.stockReserved);

  const toDelivered = await setStatus(order.orderNo, 'delivered');
  assert.equal(toDelivered.status, 200);
});

test('pending -> cancelled releases the reservation; double release is a no-op', async () => {
  const order = await createOrder(2);
  const { releaseOrderReservation } = await import('./inventory.js');

  const before = (await product())!;
  const res = await setStatus(order.orderNo, 'cancelled', { reason: 'Khách đổi ý' });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const after = (await product())!;
  assert.equal(after.stockOnHand, before.stockOnHand, 'cancellation never touches stock on hand');
  assert.equal(after.stockReserved, before.stockReserved - 2);

  const { OrderModel } = await import('../../models/Order.js');
  const doc = await OrderModel.findById(order.id).exec();
  assert.equal(doc!.inventoryState, 'released');

  // Direct replay of the release cannot modify stock twice.
  assert.equal(await releaseOrderReservation(order.id), false);
  const final = (await product())!;
  assert.equal(final.stockReserved, after.stockReserved);
});

test('processing -> cancelled releases the reservation exactly once', async () => {
  const order = await createOrder(1);
  assert.equal((await setStatus(order.orderNo, 'processing')).status, 200);

  const before = (await product())!;
  const res = await setStatus(order.orderNo, 'cancelled');
  assert.equal(res.status, 200);
  const after = (await product())!;
  assert.equal(after.stockOnHand, before.stockOnHand);
  assert.equal(after.stockReserved, before.stockReserved - 1);
});

test('invalid transitions are rejected and never touch inventory', async () => {
  const pending = await createOrder(1);
  const stockBefore = (await product())!;

  const jumpShip = await setStatus(pending.orderNo, 'shipped');
  assert.equal(jumpShip.status, 400);
  assert.equal(errorCode(jumpShip.body), 'INVALID_STATUS_TRANSITION');

  assert.equal((await setStatus(pending.orderNo, 'processing')).status, 200);
  const backward = await setStatus(pending.orderNo, 'pending');
  assert.equal(backward.status, 400);
  assert.equal(errorCode(backward.body), 'INVALID_STATUS_TRANSITION');

  assert.equal((await setStatus(pending.orderNo, 'shipped')).status, 200);
  for (const target of ['processing', 'cancelled', 'pending'] as const) {
    const res = await setStatus(pending.orderNo, target);
    assert.equal(res.status, 400, `shipped -> ${target} must be rejected`);
    assert.equal(errorCode(res.body), 'INVALID_STATUS_TRANSITION');
  }

  assert.equal((await setStatus(pending.orderNo, 'delivered')).status, 200);
  for (const target of ['processing', 'cancelled', 'shipped'] as const) {
    const res = await setStatus(pending.orderNo, target);
    assert.equal(res.status, 400, `delivered -> ${target} must be rejected`);
  }

  const cancelled = await createOrder(1);
  assert.equal((await setStatus(cancelled.orderNo, 'cancelled')).status, 200);
  for (const target of ['pending', 'processing', 'shipped', 'delivered'] as const) {
    const res = await setStatus(cancelled.orderNo, target);
    assert.equal(res.status, 400, `cancelled -> ${target} must be rejected`);
  }

  const stockAfter = (await product())!;
  // Net effect vs `stockBefore`: the shipped order's reservation (already
  // counted above) is consumed (-1), and the cancelled order's reservation is
  // created then released (0).
  assert.equal(
    stockAfter.stockOnHand,
    stockBefore.stockOnHand - 1,
    'only the one real shipment deducts',
  );
  assert.equal(stockAfter.stockReserved, stockBefore.stockReserved - 1);
});

// ---------- Story 4.4: manual payment ----------

test('employee marks unpaid -> paid (sets paidAt), paid -> unpaid (clears paidAt)', async () => {
  const order = await createOrder(1);

  const toPaid = await setPayment(order.orderNo, 'paid');
  assert.equal(toPaid.status, 200, JSON.stringify(toPaid.body));
  const paid = toPaid.body.data as { paymentStatus: string; paidAt: string | null };
  assert.equal(paid.paymentStatus, 'paid');
  assert.notEqual(paid.paidAt, null);

  const toUnpaid = await setPayment(order.orderNo, 'unpaid');
  assert.equal(toUnpaid.status, 200);
  const unpaid = toUnpaid.body.data as { paymentStatus: string; paidAt: string | null };
  assert.equal(unpaid.paymentStatus, 'unpaid');
  assert.equal(unpaid.paidAt, null);
});

test('setting payment to its current value is a no-op with no audit entry', async () => {
  const order = await createOrder(1);
  const auditsBefore = await auditCount(order.id, 'order.payment_status_change');

  const res = await setPayment(order.orderNo, 'unpaid');
  assert.equal(res.status, 200);
  assert.equal((res.body.data as { paymentStatus: string }).paymentStatus, 'unpaid');
  assert.equal(await auditCount(order.id, 'order.payment_status_change'), auditsBefore);
});

test('customer cannot call the payment or status mutation APIs', async () => {
  const order = await createOrder(1);
  const pay = await api('PATCH', `/api/employee/orders/${order.orderNo}/payment`, {
    token: customerToken,
    body: { paymentStatus: 'paid' },
  });
  assert.equal(pay.status, 403);
  const status = await api('PATCH', `/api/employee/orders/${order.orderNo}/status`, {
    token: customerToken,
    body: { status: 'processing' },
  });
  assert.equal(status.status, 403);

  const doc = await api('GET', `/api/employee/orders/${order.orderNo}`, { token: staffToken });
  assert.equal((doc.body.data as { paymentStatus: string }).paymentStatus, 'unpaid');
  assert.equal((doc.body.data as { orderStatus: string }).orderStatus, 'pending');
});

test('payment update rejects invalid values', async () => {
  const order = await createOrder(1);
  const res = await setPayment(order.orderNo, 'refunded');
  assert.equal(res.status, 400);
});

// ---------- Story 4.5: audit + timeline evidence ----------

test('status transition writes a timeline event and an audit entry with actor and values', async () => {
  const order = await createOrder(1);
  const { OrderStatusEventModel } = await import('../../models/OrderStatusEvent.js');
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  const { UserModel } = await import('../../models/User.js');
  const staff = await UserModel.findOne({ email: 'staff@test.dev' }).exec();

  const eventsBefore = await OrderStatusEventModel.countDocuments({ orderId: order.id }).exec();
  const auditsBefore = await auditCount(order.id);

  const res = await setStatus(order.orderNo, 'processing', { note: 'Đã gọi xác nhận' });
  assert.equal(res.status, 200);

  const events = await OrderStatusEventModel.find({ orderId: order.id }).sort({ createdAt: 1 }).exec();
  assert.equal(events.length, eventsBefore + 1);
  const last = events[events.length - 1];
  assert.equal(last.fromStatus, 'pending');
  assert.equal(last.toStatus, 'processing');
  assert.equal(String(last.changedBy), String(staff!._id));
  assert.equal(last.reason, 'Đã gọi xác nhận');

  const audits = await AuditLogModel.find({
    entityType: 'order',
    entityId: order.id,
    action: 'order.status_change',
  })
    .sort({ createdAt: -1 })
    .exec();
  assert.equal(audits.length, 1, 'exactly one status_change audit entry is created');
  assert.equal(await auditCount(order.id), auditsBefore + 1, 'no other audit rows are written');
  const entry = audits[0];
  assert.equal(String(entry.actor.userId), String(staff!._id));
  assert.equal(entry.actor.role, 'employee');
  assert.deepEqual(entry.previousValue, { orderStatus: 'pending' });
  assert.deepEqual(entry.nextValue, { orderStatus: 'processing' });
  assert.equal(entry.note, 'Đã gọi xác nhận');
});

test('payment change writes an audit entry; failed operations write none', async () => {
  const order = await createOrder(1);
  const { AuditLogModel } = await import('../../models/AuditLog.js');

  const before = await AuditLogModel.countDocuments({ entityType: 'order', entityId: order.id }).exec();

  const bad = await setStatus(order.orderNo, 'delivered');
  assert.equal(bad.status, 400);
  const badPay = await setPayment(order.orderNo, 'paid-but-broken');
  assert.equal(badPay.status, 400);
  assert.equal(
    await AuditLogModel.countDocuments({ entityType: 'order', entityId: order.id }).exec(),
    before,
    'failed operations must not create audit records',
  );

  const res = await api('PATCH', `/api/employee/orders/${order.orderNo}/payment`, {
    token: staffToken,
    body: { paymentStatus: 'paid', note: 'Đã nhận chuyển khoản' },
  });
  assert.equal(res.status, 200);

  const entry = await AuditLogModel.findOne({
    entityType: 'order',
    entityId: order.id,
    action: 'order.payment_status_change',
  }).exec();
  assert.ok(entry);
  assert.equal(entry!.actor.role, 'employee');
  assert.equal((entry!.previousValue as { paymentStatus: string }).paymentStatus, 'unpaid');
  assert.equal((entry!.nextValue as { paymentStatus: string }).paymentStatus, 'paid');
  assert.equal(entry!.note, 'Đã nhận chuyển khoản');
});
