import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Epic 8 integration checks — loyalty accrual at shipped, redemption rules,
 * tier free shipping, and admin tier-config/manual adjustments against a
 * real MongoDB test database (same pattern as modules/orders/checkout.test.ts).
 * Requires MongoDB running; override with MONGODB_TEST_URI_LOYALTY.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI_LOYALTY ?? 'mongodb://127.0.0.1:27017/drdo_vn_test_loyalty';

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
  fullName: 'Nguyễn Loyalty',
  phone: '0912345678',
  line1: '12 Đường Test',
  ward: 'Phường Test',
  district: 'Quận Test',
  province: 'TP. Hồ Chí Minh',
};

const products: Record<string, { id: string; price: number }> = {};

async function addToCart(token: string, productId: string, qty: number) {
  return api('POST', '/api/cart/items', { token, body: { productId, qty } });
}

async function checkoutOrder(token: string, extra: Record<string, unknown> = {}) {
  return api('POST', '/api/orders', {
    token,
    body: { paymentMethod: 'cod', shipping: SHIPPING, ...extra },
  });
}

async function shipOrder(token: string, orderNo: string) {
  const toProcessing = await api('PATCH', `/api/employee/orders/${orderNo}/status`, {
    token,
    body: { status: 'processing' },
  });
  assert.equal(toProcessing.status, 200, JSON.stringify(toProcessing.body));
  return api('PATCH', `/api/employee/orders/${orderNo}/status`, {
    token,
    body: { status: 'shipped' },
  });
}

async function adjustPoints(adminToken: string, customerId: string, points: number, reason: string) {
  return api('POST', `/api/admin/customers/${customerId}/loyalty/adjustments`, {
    token: adminToken,
    body: { points, reason },
  });
}

async function userId(email: string): Promise<string> {
  const { UserModel } = await import('../../models/User.js');
  const user = await UserModel.findOne({ email }).exec();
  assert.ok(user, `missing test user ${email}`);
  return String(user._id);
}

async function ledgerFor(email: string) {
  const { LoyaltyLedgerEntryModel } = await import('../../models/LoyaltyLedgerEntry.js');
  const id = await userId(email);
  return LoyaltyLedgerEntryModel.find({ userId: id }).sort({ createdAt: 1 }).exec();
}

const CUSTOMERS = [
  'loyal-accrue@test.dev',
  'loyal-multiplier@test.dev',
  'loyal-upgrade@test.dev',
  'loyal-redeem@test.dev',
  'loyal-invalid@test.dev',
  'loyal-cap@test.dev',
  'loyal-poor@test.dev',
  'loyal-gold@test.dev',
  'loyal-preview@test.dev',
  'loyal-platinum@test.dev',
  'loyal-cancel@test.dev',
  'loyal-adjust@test.dev',
];

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
  const { LoyaltyLedgerEntryModel } = await import('../../models/LoyaltyLedgerEntry.js');
  const { LoyaltyAccountModel } = await import('../../models/LoyaltyAccount.js');
  const { MembershipTierModel } = await import('../../models/MembershipTier.js');
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
    ProductModel.deleteMany({}),
    BrandModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    LoyaltyLedgerEntryModel.deleteMany({}),
    LoyaltyAccountModel.deleteMany({}),
    MembershipTierModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ]);
  await LoyaltyLedgerEntryModel.syncIndexes();
  await LoyaltyAccountModel.syncIndexes();
  await MembershipTierModel.syncIndexes();

  const passwordHash = await hashPassword(PASSWORD);
  for (const email of CUSTOMERS) {
    await UserModel.create({
      email,
      passwordHash,
      fullName: `Test ${email}`,
      roles: ['customer'],
      status: 'active',
    });
  }
  await UserModel.create({
    email: 'loyal-employee@test.dev',
    passwordHash,
    fullName: 'Test Employee',
    roles: ['employee'],
    status: 'active',
  });
  await UserModel.create({
    email: 'loyal-admin@test.dev',
    passwordHash,
    fullName: 'Test Admin',
    roles: ['admin'],
    status: 'active',
  });

  // Seeded tiers per spec: BRONZE 0/1.0/null; SILVER 2000/1.1/500000;
  // GOLD 5000/1.25/300000; PLATINUM 15000/1.5/0.
  for (const [code, minLifetimePoints, earnMultiplier, freeShippingThreshold] of [
    ['BRONZE', 0, 1, null],
    ['SILVER', 2000, 1.1, 500_000],
    ['GOLD', 5000, 1.25, 300_000],
    ['PLATINUM', 15_000, 1.5, 0],
  ] as const) {
    await MembershipTierModel.create({
      code,
      name: code,
      minLifetimePoints,
      earnMultiplier,
      freeShippingThreshold,
      isActive: true,
    });
  }

  const brand = await BrandModel.create({ name: 'Loyalty Brand', slug: 'loyalty-brand' });
  const category = await CategoryModel.create({ name: 'Loyalty Cat', slug: 'loyalty-cat' });
  const seeds: Array<[string, number]> = [
    ['big', 2_120_000],
    ['tiny', 500],
    ['mil', 1_000_000],
    ['mid', 300_000],
    ['gold-order', 350_000],
    ['upgrade', 500_000],
  ];
  for (const [key, price] of seeds) {
    const product = await ProductModel.create({
      name: `Loyalty ${key}`,
      slug: `loyalty-${key}`,
      sku: `LOY-${key.toUpperCase()}`,
      price,
      stockOnHand: 50,
      category: category._id,
      brand: brand._id,
      isActive: true,
    });
    products[key] = { id: String(product._id), price };
  }

  server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  const { disconnectDatabase } = await import('../../db/connect.js');
  server.close();
  await disconnectDatabase();
});

// ---------- Accrual ----------

test('accrual at shipped: grandTotal 2,150,000 with 30,000 fee earns 2,120 pts once', async () => {
  const { LoyaltyLedgerEntryModel } = await import('../../models/LoyaltyLedgerEntry.js');
  const { OrderModel } = await import('../../models/Order.js');
  const { accrueForOrder } = await import('./loyalty.service.js');
  const token = await login('loyal-accrue@test.dev');
  const employee = await login('loyal-employee@test.dev');

  assert.equal((await addToCart(token, products.big.id, 1)).status, 201);
  const res = await checkoutOrder(token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.data as { id: string; orderNo: string; totals: { grandTotal: number } };
  assert.equal(order.totals.grandTotal, 2_150_000);

  const shipped = await shipOrder(employee, order.orderNo);
  assert.equal(shipped.status, 200, JSON.stringify(shipped.body));

  const entries = await LoyaltyLedgerEntryModel.find({ orderNo: order.orderNo }).exec();
  const accruals = entries.filter((entry) => entry.kind === 'accrual');
  assert.equal(accruals.length, 1, 'exactly one accrual entry');
  assert.equal(accruals[0].delta, 2120);
  assert.equal(accruals[0].balanceAfter, 2120);
  assert.ok(accruals[0].actor?.userId, 'accrual records the shipping actor');

  const summary = await api('GET', '/api/loyalty', { token });
  assert.equal((summary.body.data as { balance: number }).balance, 2120);
  assert.equal((summary.body.data as { lifetimeEarned: number }).lifetimeEarned, 2120);
  assert.equal((summary.body.data as { tierCode: string }).tierCode, 'SILVER');

  // Duplicate ship replay: a second accrual attempt is a silent no-op.
  const doc = await OrderModel.findOne({ orderNo: order.orderNo }).exec();
  await accrueForOrder(doc!);
  const after = await LoyaltyLedgerEntryModel.find({
    orderNo: order.orderNo,
    kind: 'accrual',
  }).exec();
  assert.equal(after.length, 1, 'replay adds nothing');
});

test('zero accrual: earnBase < 1000 still writes a delta=0 accrual marker', async () => {
  const { LoyaltyLedgerEntryModel } = await import('../../models/LoyaltyLedgerEntry.js');
  const token = await login('loyal-accrue@test.dev');
  const employee = await login('loyal-employee@test.dev');

  assert.equal((await addToCart(token, products.tiny.id, 1)).status, 201);
  const res = await checkoutOrder(token);
  assert.equal(res.status, 201);
  const orderNo = (res.body.data as { orderNo: string }).orderNo;

  assert.equal((await shipOrder(employee, orderNo)).status, 200);
  const accrual = await LoyaltyLedgerEntryModel.findOne({
    orderNo,
    kind: 'accrual',
  }).exec();
  assert.ok(accrual, 'accrual marker row exists even when nothing is earned');
  assert.equal(accrual.delta, 0);
});

test('tier multiplier: Silver customer earns 1.1x (base 1000 → 1100 pts)', async () => {
  const token = await login('loyal-multiplier@test.dev');
  const employee = await login('loyal-employee@test.dev');
  const admin = await login('loyal-admin@test.dev');

  // Push lifetime past the SILVER floor via a manual adjustment.
  const customerId = await userId('loyal-multiplier@test.dev');
  assert.equal((await adjustPoints(admin, customerId, 2500, 'Bonus')).status, 201);

  assert.equal((await addToCart(token, products.mil.id, 1)).status, 201);
  const res = await checkoutOrder(token);
  assert.equal(res.status, 201);
  const orderNo = (res.body.data as { orderNo: string }).orderNo;
  assert.equal((await shipOrder(employee, orderNo)).status, 200);

  const entries = await ledgerFor('loyal-multiplier@test.dev');
  const accrual = entries.find((entry) => entry.kind === 'accrual');
  assert.equal(accrual?.delta, 1100);
});

test('tier upgrade: crossing a floor writes a tier_change entry and raises tierCode', async () => {
  const { LoyaltyAccountModel } = await import('../../models/LoyaltyAccount.js');
  const token = await login('loyal-upgrade@test.dev');
  const employee = await login('loyal-employee@test.dev');
  const admin = await login('loyal-admin@test.dev');

  const customerId = await userId('loyal-upgrade@test.dev');
  assert.equal((await adjustPoints(admin, customerId, 1900, 'Bonus')).status, 201);
  let account = await LoyaltyAccountModel.findOne({ userId: customerId }).exec();
  assert.equal(account?.tierCode ?? 'BRONZE', 'BRONZE');

  // 500,000đ earnBase → +500 pts → lifetime 2400 ≥ 2000 → SILVER.
  assert.equal((await addToCart(token, products.upgrade.id, 1)).status, 201);
  const res = await checkoutOrder(token);
  assert.equal(res.status, 201);
  const orderNo = (res.body.data as { orderNo: string }).orderNo;
  assert.equal((await shipOrder(employee, orderNo)).status, 200);

  account = await LoyaltyAccountModel.findOne({ userId: customerId }).exec();
  assert.equal(account?.tierCode, 'SILVER');
  const entries = await ledgerFor('loyal-upgrade@test.dev');
  const tierChange = entries.find((entry) => entry.kind === 'tier_change');
  assert.ok(tierChange, 'tier_change ledger entry exists');
  assert.equal(tierChange.delta, 0);
});

// ---------- Redemption ----------

test('redeem ok: 500 pts against balance 800 discounts 5,000đ and writes the ledger entry', async () => {
  const token = await login('loyal-redeem@test.dev');
  const admin = await login('loyal-admin@test.dev');
  const customerId = await userId('loyal-redeem@test.dev');
  assert.equal((await adjustPoints(admin, customerId, 800, 'Welcome bonus')).status, 201);

  assert.equal((await addToCart(token, products.mid.id, 1)).status, 201);
  const res = await checkoutOrder(token, { pointsToRedeem: 500 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.data as {
    orderNo: string;
    totals: { pointsRedeemed: number; pointsDiscountAmount: number; grandTotal: number };
  };
  assert.equal(order.totals.pointsRedeemed, 500);
  assert.equal(order.totals.pointsDiscountAmount, 5000);
  assert.equal(order.totals.grandTotal, 300_000 - 5000 + 30_000);

  const entries = await ledgerFor('loyal-redeem@test.dev');
  const redemption = entries.find((entry) => entry.kind === 'redemption');
  assert.ok(redemption, 'redemption ledger entry written at order creation');
  assert.equal(redemption.delta, -500);
  assert.equal(redemption.balanceAfter, 300);
  assert.equal(redemption.orderNo, order.orderNo);
});

test('redemption rejects non-multiples of 100 with INVALID_POINTS_AMOUNT', async () => {
  const token = await login('loyal-invalid@test.dev');
  assert.equal((await addToCart(token, products.mid.id, 1)).status, 201);
  const res = await checkoutOrder(token, { pointsToRedeem: 150 });
  assert.equal(res.status, 400);
  assert.equal(errorCode(res.body), 'INVALID_POINTS_AMOUNT');
});

test('redemption cap: 7,000 pts exceeds 20% of a 300,000đ subtotal → POINTS_CAP_EXCEEDED', async () => {
  const token = await login('loyal-cap@test.dev');
  const admin = await login('loyal-admin@test.dev');
  const customerId = await userId('loyal-cap@test.dev');
  assert.equal((await adjustPoints(admin, customerId, 10_000, 'Bonus')).status, 201);

  assert.equal((await addToCart(token, products.mid.id, 1)).status, 201);
  const res = await checkoutOrder(token, { pointsToRedeem: 7000 });
  assert.equal(res.status, 400);
  assert.equal(errorCode(res.body), 'POINTS_CAP_EXCEEDED');
});

test('redemption beyond balance → INSUFFICIENT_POINTS and leaves no ledger entry', async () => {
  const token = await login('loyal-poor@test.dev');
  const admin = await login('loyal-admin@test.dev');
  const customerId = await userId('loyal-poor@test.dev');
  assert.equal((await adjustPoints(admin, customerId, 300, 'Bonus')).status, 201);

  assert.equal((await addToCart(token, products.mid.id, 1)).status, 201);
  const res = await checkoutOrder(token, { pointsToRedeem: 500 });
  assert.equal(res.status, 400);
  assert.equal(errorCode(res.body), 'INSUFFICIENT_POINTS');

  const entries = await ledgerFor('loyal-poor@test.dev');
  assert.equal(
    entries.filter((entry) => entry.kind === 'redemption').length,
    0,
    'a rejected redemption must not append to the ledger',
  );
});

// ---------- Tier free shipping ----------

test('free shipping: Gold tier threshold met pre-redemption → fee 0 even with points', async () => {
  const token = await login('loyal-gold@test.dev');
  const admin = await login('loyal-admin@test.dev');
  const customerId = await userId('loyal-gold@test.dev');
  assert.equal((await adjustPoints(admin, customerId, 5000, 'Bonus')).status, 201);

  const preview = await api('POST', '/api/orders/preview', {
    token,
    body: { pointsToRedeem: 1000 },
  });
  // Cart is still empty — preview must fail before we add items.
  assert.equal(preview.status, 400);

  assert.equal((await addToCart(token, products['gold-order'].id, 1)).status, 201);
  const res = await checkoutOrder(token, { pointsToRedeem: 1000 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.data as {
    membershipTierCode: string | null;
    totals: {
      subtotal: number;
      pointsDiscountAmount: number;
      shippingFee: number;
      grandTotal: number;
    };
  };
  assert.equal(order.totals.subtotal, 350_000);
  assert.equal(order.totals.shippingFee, 0, '350,000 ≥ 300,000 threshold → free shipping');
  assert.equal(order.totals.pointsDiscountAmount, 10_000);
  assert.equal(order.totals.grandTotal, 340_000);
  assert.equal(order.membershipTierCode, 'GOLD');
});

// ---------- Admin adjustments ----------

test('admin adjustment writes a ledger entry and a loyalty.points_adjustment audit', async () => {
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  const admin = await login('loyal-admin@test.dev');
  const customerId = await userId('loyal-adjust@test.dev');

  // Self-contained: fund the account first so the -200 lands on 500.
  assert.equal((await adjustPoints(admin, customerId, 500, 'Nạp điểm')).status, 201);
  const res = await adjustPoints(admin, customerId, -200, 'Điều chỉnh thủ công');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const entry = res.body.data as { kind: string; delta: number; balanceAfter: number };
  assert.equal(entry.kind, 'adjustment');
  assert.equal(entry.delta, -200);
  assert.equal(entry.balanceAfter, 300);

  const audit = await AuditLogModel.findOne({ action: 'loyalty.points_adjustment' })
    .sort({ createdAt: -1 })
    .exec();
  assert.ok(audit, 'audit record exists');
  assert.equal((audit.nextValue as { delta: number }).delta, -200);

  const summary = await api('GET', `/api/admin/customers/${customerId}/loyalty`, {
    token: admin,
  });
  assert.equal(summary.status, 200);
  assert.equal((summary.body.data as { summary: { balance: number } }).summary.balance, 300);
});

test('adjustment without a reason → 400; employee attempting it → 403', async () => {
  const admin = await login('loyal-admin@test.dev');
  const employee = await login('loyal-employee@test.dev');
  const customerId = await userId('loyal-accrue@test.dev');

  const missingReason = await api('POST', `/api/admin/customers/${customerId}/loyalty/adjustments`, {
    token: admin,
    body: { points: -200 },
  });
  assert.equal(missingReason.status, 400);

  const denied = await adjustPoints(employee, customerId, -200, 'Employee attempt');
  assert.equal(denied.status, 403);
  assert.equal(errorCode(denied.body), 'FORBIDDEN');
});

test('negative adjustment beyond balance → INSUFFICIENT_POINTS and writes nothing', async () => {
  const admin = await login('loyal-admin@test.dev');
  const customerId = await userId('loyal-adjust@test.dev'); // balance 300

  const res = await adjustPoints(admin, customerId, -500, 'Clawback too big');
  assert.equal(res.status, 400);
  assert.equal(errorCode(res.body), 'INSUFFICIENT_POINTS');

  const entries = await ledgerFor('loyal-adjust@test.dev');
  assert.equal(
    entries.filter((entry) => entry.kind === 'adjustment').length,
    2,
    'the rejected adjustment must not append to the ledger',
  );
});

// ---------- Preview / history / tiers endpoints ----------

test('preview returns server totals plus the loyalty block; BRONZE null threshold charges 30,000đ', async () => {
  const token = await login('loyal-preview@test.dev');
  assert.equal((await addToCart(token, products.mid.id, 1)).status, 201);

  const res = await api('POST', '/api/orders/preview', { token, body: { pointsToRedeem: 0 } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const data = res.body.data as {
    itemCount: number;
    totals: { subtotal: number; shippingFee: number; grandTotal: number; pointsRedeemed: number };
    loyalty: {
      balance: number;
      tierCode: string;
      freeShippingThreshold: number | null;
      freeShippingApplied: boolean;
      maxRedeemablePoints: number;
      pointsToRedeem: number;
    };
  };
  assert.equal(data.totals.subtotal, 300_000);
  assert.equal(data.totals.shippingFee, 30_000, 'null threshold = no free-shipping benefit');
  assert.equal(data.totals.grandTotal, 330_000);
  assert.equal(data.totals.pointsRedeemed, 0);
  assert.equal(data.loyalty.tierCode, 'BRONZE');
  assert.equal(data.loyalty.balance, 0);
  assert.equal(data.loyalty.freeShippingApplied, false);
  assert.equal(data.loyalty.maxRedeemablePoints, 0);
  assert.equal(data.loyalty.pointsToRedeem, 0);
});

test('GET /loyalty/history returns the paginated ledger; employees are rejected 403', async () => {
  const token = await login('loyal-accrue@test.dev');
  const employee = await login('loyal-employee@test.dev');

  const res = await api('GET', '/api/loyalty/history?page=1&limit=5', { token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const items = res.body.data as Array<{ kind: string; delta: number; balanceAfter: number }>;
  const meta = res.body.meta as { page: number; limit: number; total: number };
  assert.equal(meta.page, 1);
  assert.equal(meta.limit, 5);
  assert.ok(meta.total >= 2, 'accrual + tier_change entries exist for this customer');
  assert.ok(items.length >= 1 && items.length <= 5);
  assert.ok(
    items.every((entry) => typeof entry.delta === 'number' && typeof entry.balanceAfter === 'number'),
  );

  assert.equal((await api('GET', '/api/loyalty', { token: employee })).status, 403);
  assert.equal((await api('GET', '/api/loyalty/history', { token: employee })).status, 403);
});

test('GET/PATCH /admin/loyalty/tiers lists tiers sorted by floor and applies edits', async () => {
  const admin = await login('loyal-admin@test.dev');
  const employee = await login('loyal-employee@test.dev');

  assert.equal((await api('GET', '/api/admin/loyalty/tiers', { token: employee })).status, 403);

  const list = await api('GET', '/api/admin/loyalty/tiers', { token: admin });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const tiers = list.body.data as Array<{
    id: string;
    code: string;
    minLifetimePoints: number;
    earnMultiplier: number;
    displayOrder: number;
  }>;
  assert.deepEqual(
    tiers.map((tier) => tier.code),
    ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
  );

  const silver = tiers.find((tier) => tier.code === 'SILVER')!;
  const patched = await api('PATCH', `/api/admin/loyalty/tiers/${silver.id}`, {
    token: admin,
    body: { name: 'Bạc mới', earnMultiplier: 1.2 },
  });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  const updated = patched.body.data as { name: string; earnMultiplier: number; displayOrder: number };
  assert.equal(updated.name, 'Bạc mới');
  assert.equal(updated.earnMultiplier, 1.2);
  assert.equal(updated.displayOrder, silver.displayOrder, 'displayOrder round-trips');

  // Restore so later runs and sibling tests see the seeded values.
  const restored = await api('PATCH', `/api/admin/loyalty/tiers/${silver.id}`, {
    token: admin,
    body: { name: 'SILVER', earnMultiplier: 1.1 },
  });
  assert.equal(restored.status, 200);
});

// ---------- Remaining matrix behaviors ----------

test('PLATINUM threshold=0 means free shipping on every order', async () => {
  const token = await login('loyal-platinum@test.dev');
  const admin = await login('loyal-admin@test.dev');
  const customerId = await userId('loyal-platinum@test.dev');
  assert.equal((await adjustPoints(admin, customerId, 15_000, 'VIP bonus')).status, 201);

  assert.equal((await addToCart(token, products.tiny.id, 1)).status, 201);
  const res = await checkoutOrder(token);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.data as {
    membershipTierCode: string | null;
    totals: { shippingFee: number; grandTotal: number };
  };
  assert.equal(order.membershipTierCode, 'PLATINUM');
  assert.equal(order.totals.shippingFee, 0, 'threshold 0 = always free, even on a 500đ order');
  assert.equal(order.totals.grandTotal, 500);
});

test('cancelled orders do not refund redeemed points', async () => {
  const token = await login('loyal-cancel@test.dev');
  const employee = await login('loyal-employee@test.dev');
  const admin = await login('loyal-admin@test.dev');
  const customerId = await userId('loyal-cancel@test.dev');
  assert.equal((await adjustPoints(admin, customerId, 600, 'Bonus')).status, 201);

  assert.equal((await addToCart(token, products.mid.id, 1)).status, 201);
  const res = await checkoutOrder(token, { pointsToRedeem: 500 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const orderNo = (res.body.data as { orderNo: string }).orderNo;

  const cancelled = await api('PATCH', `/api/employee/orders/${orderNo}/status`, {
    token: employee,
    body: { status: 'cancelled' },
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

  const entries = await ledgerFor('loyal-cancel@test.dev');
  const redemption = entries.find((entry) => entry.kind === 'redemption');
  assert.ok(redemption, 'redemption entry stays after cancellation');
  assert.equal(redemption.delta, -500);
  assert.equal(entries.filter((entry) => entry.delta > 0 && entry.kind !== 'adjustment').length, 0);

  const summary = await api('GET', '/api/loyalty', { token });
  assert.equal((summary.body.data as { balance: number }).balance, 100, 'no refund on cancel');
});
