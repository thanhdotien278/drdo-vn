import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Epic 9 integration checks — promotions/coupons admin CRUD, the QA §14.5
 * rejection ladder on preview + checkout, redemption release on cancel, and
 * the admin usage view, against a real MongoDB test database (same harness
 * as modules/orders/checkout.test.ts). Requires MongoDB running; override
 * with MONGODB_TEST_URI_PROMOTIONS.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI_PROMOTIONS ?? 'mongodb://127.0.0.1:27017/drdo_vn_test_promotions';

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
  fullName: 'Nguyễn Coupon',
  phone: '0912345678',
  line1: '12 Đường Test',
  ward: 'Phường Test',
  district: 'Quận Test',
  province: 'TP. Hồ Chí Minh',
};

const products: Record<string, { id: string; price: number }> = {};
const couponIds: Record<string, string> = {};
const promotionIds: Record<string, string> = {};

async function addToCart(token: string, productId: string, qty: number) {
  return api('POST', '/api/cart/items', { token, body: { productId, qty } });
}

async function clearCart(token: string): Promise<void> {
  const cart = await api('GET', '/api/cart', { token });
  const items = (cart.body.data as { items?: Array<{ id: string }> }).items ?? [];
  for (const item of items) {
    await api('DELETE', `/api/cart/items/${item.id}`, { token });
  }
}

async function preview(token: string, body: Record<string, unknown> = {}) {
  return api('POST', '/api/orders/preview', { token, body });
}

async function checkoutOrder(token: string, extra: Record<string, unknown> = {}) {
  return api('POST', '/api/orders', {
    token,
    body: { paymentMethod: 'cod', shipping: SHIPPING, ...extra },
  });
}

async function redemptionFor(orderNo: string) {
  const { CouponRedemptionModel } = await import('../../models/CouponRedemption.js');
  return CouponRedemptionModel.findOne({ orderNo }).exec();
}

const DAY = 24 * 3600 * 1000;

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
  const { PromotionModel } = await import('../../models/Promotion.js');
  const { CouponModel } = await import('../../models/Coupon.js');
  const { CouponRedemptionModel } = await import('../../models/CouponRedemption.js');
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
    LoyaltyLedgerEntryModel.deleteMany({}),
    LoyaltyAccountModel.deleteMany({}),
    MembershipTierModel.deleteMany({}),
    PromotionModel.deleteMany({}),
    CouponModel.deleteMany({}),
    CouponRedemptionModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
    ProductModel.deleteMany({}),
    BrandModel.deleteMany({}),
    CategoryModel.deleteMany({}),
  ]);

  const passwordHash = await hashPassword(PASSWORD);
  const customers: Record<string, string> = {};
  for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const user = await UserModel.create({
      email: `promo-${key}@test.dev`,
      passwordHash,
      fullName: `Promo ${key}`,
      roles: ['customer'],
      status: 'active',
    });
    customers[key] = String(user._id);
  }
  await UserModel.create({
    email: 'promo-staff@test.dev',
    passwordHash,
    fullName: 'Promo Staff',
    roles: ['employee'],
    status: 'active',
  });
  await UserModel.create({
    email: 'promo-admin@test.dev',
    passwordHash,
    fullName: 'Promo Admin',
    roles: ['admin'],
    status: 'active',
  });

  // Tiers: BRONZE has no benefit; SILVER frees shipping at 500k (discounted base).
  await MembershipTierModel.insertMany([
    { code: 'BRONZE', name: 'Đồng', minLifetimePoints: 0, freeShippingThreshold: null },
    { code: 'SILVER', name: 'Bạc', minLifetimePoints: 2000, freeShippingThreshold: 500_000 },
    { code: 'GOLD', name: 'Vàng', minLifetimePoints: 5000, freeShippingThreshold: 300_000 },
  ]);
  // cust-c is SILVER — used for the free-shipping-base ordering check.
  await LoyaltyAccountModel.create({ userId: customers.c, tierCode: 'SILVER' });

  const brandX = await BrandModel.create({ name: 'Promo Brand X', slug: 'promo-brand-x' });
  const brandY = await BrandModel.create({ name: 'Promo Brand Y', slug: 'promo-brand-y' });
  const category = await CategoryModel.create({ name: 'Promo Cat', slug: 'promo-cat' });

  const productSeeds: Array<[string, number, unknown]> = [
    // key, price, brand
    ['x300', 300_000, brandX._id],
    ['y2000', 2_000_000, brandY._id],
    ['x250', 250_000, brandX._id],
    ['y250', 250_000, brandY._id],
  ];
  for (const [key, price, brand] of productSeeds) {
    const product = await ProductModel.create({
      name: `Promo ${key}`,
      slug: `promo-${key}`,
      sku: `PRM-${key.toUpperCase()}`,
      price,
      stockOnHand: 100,
      category: category._id,
      brand,
      isActive: true,
    });
    products[key] = { id: String(product._id), price };
  }

  const makePromo = async (key: string, fields: Record<string, unknown>) => {
    const promo = await PromotionModel.create({ name: `Promo ${key}`, ...fields });
    promotionIds[key] = String(promo._id);
    return promo;
  };
  const makeCoupon = async (key: string, promotionKey: string, fields: Record<string, unknown> = {}) => {
    const coupon = await CouponModel.create({
      code: key,
      promotionId: promotionIds[promotionKey],
      ...fields,
    });
    couponIds[key] = String(coupon._id);
    return coupon;
  };

  await makePromo('cap', { discountType: 'percentage', discountValue: 10, maxDiscountAmount: 50_000 });
  await makeCoupon('CAP10', 'cap');
  await makePromo('fixed', { discountType: 'fixed_amount', discountValue: 50_000, minOrderTotal: 300_000 });
  await makeCoupon('FIXED50', 'fixed');
  await makePromo('brandx', { discountType: 'percentage', discountValue: 20, brandIds: [brandX._id] });
  await makeCoupon('BRAND20', 'brandx');
  await makePromo('prodx', { discountType: 'percentage', discountValue: 25, productIds: [products.x250.id] });
  await makeCoupon('PROD25', 'prodx');
  await makePromo('future', { discountType: 'percentage', discountValue: 25, startAt: new Date(Date.now() + 7 * DAY) });
  await makeCoupon('FUTURE25', 'future');
  await makePromo('expired', {
    discountType: 'fixed_amount',
    discountValue: 30_000,
    startAt: new Date(Date.now() - 30 * DAY),
    endAt: new Date(Date.now() - DAY),
  });
  await makeCoupon('EXPIRED30', 'expired');
  await makePromo('off', { discountType: 'percentage', discountValue: 10, isActive: false });
  await makeCoupon('PROMOOFF', 'off');
  await makeCoupon('DEAD10', 'cap', { isActive: false });
  await makePromo('tier', { discountType: 'percentage', discountValue: 15, tierCodes: ['GOLD'] });
  await makeCoupon('GOLD15', 'tier');
  await makePromo('min', { discountType: 'percentage', discountValue: 10, minOrderTotal: 500_000 });
  await makeCoupon('MIN500', 'min');
  await makePromo('onceTotal', { discountType: 'percentage', discountValue: 10 });
  await makeCoupon('ONCE1', 'onceTotal', { usageLimitTotal: 1 });
  await makePromo('onceMe', { discountType: 'percentage', discountValue: 10 });
  await makeCoupon('ONCEME', 'onceMe', { usageLimitPerCustomer: 1 });
  await makePromo('snap', { discountType: 'percentage', discountValue: 10 });
  await makeCoupon('SNAP10', 'snap');
  await makePromo('cancel', { discountType: 'fixed_amount', discountValue: 20_000 });
  await makeCoupon('CANCEL20', 'cancel');
  // Soft-deleted coupon: code released via the --del-<ts> suffix.
  await CouponModel.create({
    code: 'GHOST10--del-1',
    promotionId: promotionIds.cap,
    isDeleted: true,
    isActive: false,
  });

  server = createApp().listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  const { disconnectDatabase } = await import('../../db/connect.js');
  server.close();
  await disconnectDatabase();
});

// ---------- Admin CRUD + RBAC ----------

test('admin promotion/coupon CRUD round-trip with audit and code release', async () => {
  const admin = await login('promo-admin@test.dev');
  const { AuditLogModel } = await import('../../models/AuditLog.js');
  const { CouponModel } = await import('../../models/Coupon.js');

  const promoRes = await api('POST', '/api/admin/promotions', {
    token: admin,
    body: { name: 'Chương trình test', discountType: 'percentage', discountValue: 15 },
  });
  assert.equal(promoRes.status, 201, JSON.stringify(promoRes.body));
  const promo = promoRes.body.data as { id: string; isActive: boolean };
  assert.equal(promo.isActive, true);

  const couponRes = await api('POST', '/api/admin/coupons', {
    token: admin,
    body: { code: 'admtest5', promotionId: promo.id },
  });
  assert.equal(couponRes.status, 201, JSON.stringify(couponRes.body));
  const coupon = couponRes.body.data as { id: string; code: string; usageCount: number };
  assert.equal(coupon.code, 'ADMTEST5', 'code is normalized to uppercase');
  assert.equal(coupon.usageCount, 0);

  // Duplicate code, any case → 409 COUPON_CODE_TAKEN.
  for (const code of ['ADMTEST5', 'admtest5']) {
    const dup = await api('POST', '/api/admin/coupons', {
      token: admin,
      body: { code, promotionId: promo.id },
    });
    assert.equal(dup.status, 409);
    assert.equal(errorCode(dup.body), 'COUPON_CODE_TAKEN');
  }

  const patched = await api('PATCH', `/api/admin/promotions/${promo.id}`, {
    token: admin,
    body: { isActive: false, discountValue: 20 },
  });
  assert.equal(patched.status, 200);
  assert.equal((patched.body.data as { discountValue: number }).discountValue, 20);

  // Soft delete releases the code so it can be recreated.
  const deleted = await api('DELETE', `/api/admin/coupons/${coupon.id}`, { token: admin });
  assert.equal(deleted.status, 200);
  const stored = await CouponModel.findById(coupon.id).exec();
  assert.equal(stored!.isDeleted, true);
  assert.match(stored!.code, /^ADMTEST5--del-/i);

  const recreated = await api('POST', '/api/admin/coupons', {
    token: admin,
    body: { code: 'admtest5', promotionId: promo.id },
  });
  assert.equal(recreated.status, 201, 'released code can be reused');
  const recreatedCoupon = recreated.body.data as { id: string };

  // PATCH /admin/coupons/:id — the isActive toggle persists…
  const toggled = await api('PATCH', `/api/admin/coupons/${recreatedCoupon.id}`, {
    token: admin,
    body: { isActive: false },
  });
  assert.equal(toggled.status, 200, JSON.stringify(toggled.body));
  assert.equal((toggled.body.data as { isActive: boolean }).isActive, false);
  const storedCoupon = await CouponModel.findById(recreatedCoupon.id).exec();
  assert.equal(storedCoupon!.isActive, false, 'the toggle is persisted');

  // …and renaming onto an existing code is rejected.
  const clash = await api('PATCH', `/api/admin/coupons/${recreatedCoupon.id}`, {
    token: admin,
    body: { code: 'cap10' },
  });
  assert.equal(clash.status, 409);
  assert.equal(errorCode(clash.body), 'COUPON_CODE_TAKEN');

  const delPromo = await api('DELETE', `/api/admin/promotions/${promo.id}`, { token: admin });
  assert.equal(delPromo.status, 200);

  // GET /admin/promotions status filter: deleted rows only under status=deleted.
  const allPromos = await api('GET', '/api/admin/promotions?limit=48', { token: admin });
  const promoIds = (list: unknown) =>
    (list as Array<{ id: string }>).map((item) => item.id);
  assert.ok(!promoIds(allPromos.body.data).includes(promo.id), 'status=all hides deleted');
  const activePromos = await api('GET', '/api/admin/promotions?status=active&limit=48', {
    token: admin,
  });
  assert.ok(!promoIds(activePromos.body.data).includes(promo.id), 'status=active hides deleted');
  const deletedPromos = await api('GET', '/api/admin/promotions?status=deleted&limit=48', {
    token: admin,
  });
  assert.ok(
    promoIds(deletedPromos.body.data).includes(promo.id),
    'status=deleted shows the deleted promotion',
  );

  for (const action of [
    'promotion.create',
    'promotion.update',
    'promotion.status_change',
    'promotion.delete',
    'coupon.create',
    'coupon.status_change',
    'coupon.delete',
  ]) {
    assert.ok(
      await AuditLogModel.exists({ action }),
      `expected an audit entry for ${action}`,
    );
  }
});

test('non-admin roles get 403 on every admin promotion/coupon route', async () => {
  const customer = await login('promo-a@test.dev');
  const employee = await login('promo-staff@test.dev');
  for (const token of [customer, employee]) {
    for (const [method, path] of [
      ['GET', '/api/admin/promotions'],
      ['POST', '/api/admin/promotions'],
      ['PATCH', `/api/admin/promotions/${promotionIds.cap}`],
      ['DELETE', `/api/admin/promotions/${promotionIds.cap}`],
      ['GET', '/api/admin/coupons'],
      ['POST', '/api/admin/coupons'],
      ['PATCH', `/api/admin/coupons/${couponIds.CAP10}`],
      ['DELETE', `/api/admin/coupons/${couponIds.CAP10}`],
      ['GET', `/api/admin/coupons/${couponIds.CAP10}/redemptions`],
    ] as const) {
      const res = await api(method, path, method === 'GET' ? { token } : { token, body: {} });
      assert.equal(res.status, 403, `${method} ${path} must reject non-admin`);
    }
  }
});

// ---------- Happy paths ----------

test('percentage coupon honours maxDiscountAmount on preview and checkout', async () => {
  const token = await login('promo-a@test.dev');
  await clearCart(token);
  await addToCart(token, products.x300.id, 3); // subtotal 900k → 10% = 90k, capped 50k

  const prev = await preview(token, { couponCode: 'cap10' }); // case-insensitive
  assert.equal(prev.status, 200, JSON.stringify(prev.body));
  const prevTotals = (prev.body.data as { totals: Record<string, unknown> }).totals;
  assert.equal(prevTotals.discountAmount, 50_000);
  const couponRef = prevTotals.couponRef as {
    couponId: string;
    promotionId: string;
    code: string;
    discountType: string;
    discountValue: number;
    maxDiscountAmount: number;
  };
  assert.equal(couponRef.code, 'CAP10');
  assert.equal(couponRef.promotionId, promotionIds.cap);
  assert.equal(couponRef.discountValue, 10);
  assert.equal(couponRef.maxDiscountAmount, 50_000);

  const res = await checkoutOrder(token, { couponCode: 'cap10' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.data as { orderNo: string; totals: typeof prevTotals };
  // Preview must agree with the resulting order (QA §14.6).
  assert.equal(order.totals.discountAmount, prevTotals.discountAmount);
  assert.equal(order.totals.grandTotal, prevTotals.grandTotal);
  assert.equal(order.totals.subtotal, 900_000);
  assert.equal(order.totals.grandTotal, 900_000 - 50_000 + 30_000);

  const redemption = await redemptionFor(order.orderNo);
  assert.ok(redemption, 'a redemption row ties the coupon to the order');
  assert.equal(redemption!.status, 'applied');
  assert.equal(redemption!.code, 'CAP10');
  assert.equal(redemption!.discountAmount, 50_000);
  assert.equal(String(redemption!.couponId), couponIds.CAP10);
});

test('one coupon per order is enforced by the unique orderId index', async () => {
  const { CouponRedemptionModel } = await import('../../models/CouponRedemption.js');
  const existing = await CouponRedemptionModel.findOne({ code: 'CAP10', status: 'applied' }).exec();
  assert.ok(existing);
  await assert.rejects(
    CouponRedemptionModel.create({
      couponId: existing!.couponId,
      promotionId: existing!.promotionId,
      orderId: existing!.orderId,
      orderNo: 'DRD-DUP-1',
      userId: existing!.userId,
      code: 'CAP10',
      discountAmount: 1,
      status: 'applied',
    }),
    (error: unknown) => (error as { code?: number }).code === 11000,
  );
});

test('fixed-amount coupon applies when minOrderTotal is met', async () => {
  const token = await login('promo-b@test.dev');
  await clearCart(token);
  await addToCart(token, products.x250.id, 2); // subtotal 500k ≥ 300k

  const prev = await preview(token, { couponCode: 'FIXED50' });
  assert.equal(prev.status, 200, JSON.stringify(prev.body));
  assert.equal(
    (prev.body.data as { totals: { discountAmount: number } }).totals.discountAmount,
    50_000,
  );
});

test('scoped promotion discounts only matching lines (scope is the base)', async () => {
  const token = await login('promo-b@test.dev');
  await clearCart(token);
  await addToCart(token, products.x300.id, 1); // 300k brand X
  await addToCart(token, products.y2000.id, 1); // 2M other brand

  const prev = await preview(token, { couponCode: 'BRAND20' });
  assert.equal(prev.status, 200, JSON.stringify(prev.body));
  const totals = (prev.body.data as { totals: { subtotal: number; discountAmount: number } }).totals;
  assert.equal(totals.subtotal, 2_300_000);
  assert.equal(totals.discountAmount, 60_000, '20% of the 300k brand-X line only');
});

test('productIds scope discounts only matching product lines', async () => {
  const token = await login('promo-b@test.dev');
  await clearCart(token);
  await addToCart(token, products.x250.id, 1); // the scoped product
  await addToCart(token, products.y250.id, 1); // not in scope

  const prev = await preview(token, { couponCode: 'PROD25' });
  assert.equal(prev.status, 200, JSON.stringify(prev.body));
  const totals = (prev.body.data as { totals: { discountAmount: number } }).totals;
  assert.equal(totals.discountAmount, 62_500, '25% applies to the 250k scoped line only');
});

test('coupon + pointsToRedeem: points cap is measured on the full subtotal', async () => {
  const token = await login('promo-d@test.dev');
  const { UserModel } = await import('../../models/User.js');
  const { LoyaltyLedgerEntryModel } = await import('../../models/LoyaltyLedgerEntry.js');
  const user = await UserModel.findOne({ email: 'promo-d@test.dev' }).exec();
  await LoyaltyLedgerEntryModel.create({
    userId: user!._id,
    kind: 'adjustment',
    delta: 10_000,
    balanceAfter: 10_000,
    reason: 'test seed',
  });

  await clearCart(token);
  await addToCart(token, products.x250.id, 2); // subtotal 500k

  const prev = await preview(token, { couponCode: 'FIXED50', pointsToRedeem: 10_000 });
  assert.equal(prev.status, 200, JSON.stringify(prev.body));
  const totals = (prev.body.data as {
    totals: {
      discountAmount: number;
      shippingFee: number;
      pointsDiscountAmount: number;
      grandTotal: number;
    };
  }).totals;
  // 20% cap on the full 500k subtotal = 100k → all 10_000 points (100k)
  // redeem, even though 20% of the post-coupon 450k base would allow only 90k.
  assert.equal(totals.discountAmount, 50_000, 'coupon applies first');
  assert.equal(totals.pointsDiscountAmount, 100_000, 'cap is on the full subtotal');
  assert.equal(totals.shippingFee, 30_000, 'BRONZE pays shipping on the post-coupon subtotal');
  assert.equal(totals.grandTotal, 500_000 - 50_000 - 100_000 + 30_000);
});

// ---------- QA §14.5 rejection ladder ----------

test('each rejection state returns its distinct 400 code', async () => {
  const token = await login('promo-b@test.dev');
  // Cart: one 250k brand-Y line → subtotal 250k.
  await clearCart(token);
  await addToCart(token, products.y250.id, 1);

  const cases: Array<[string, string]> = [
    ['NOSUCHCODE', 'COUPON_NOT_FOUND'],
    ['GHOST10', 'COUPON_NOT_FOUND'], // soft-deleted codes are released → unknown
    ['DEAD10', 'COUPON_INACTIVE'], // inactive coupon
    ['PROMOOFF', 'COUPON_INACTIVE'], // inactive promotion is indistinguishable
    ['FUTURE25', 'COUPON_NOT_STARTED'],
    ['EXPIRED30', 'COUPON_EXPIRED'],
    ['GOLD15', 'COUPON_TIER_INELIGIBLE'], // cust-b is BRONZE
    ['MIN500', 'COUPON_MIN_ORDER_NOT_MET'], // subtotal 250k < 500k
    ['BRAND20', 'COUPON_NOT_APPLICABLE'], // no brand-X line in the cart
  ];
  for (const [code, expected] of cases) {
    const prev = await preview(token, { couponCode: code });
    assert.equal(prev.status, 400, `${code}: ${JSON.stringify(prev.body)}`);
    assert.equal(errorCode(prev.body), expected, `coupon ${code}`);
  }
});

test('checkout rejects invalid coupons with the same codes as preview', async () => {
  const token = await login('promo-b@test.dev');
  const res = await checkoutOrder(token, { couponCode: 'EXPIRED30' });
  assert.equal(res.status, 400);
  assert.equal(errorCode(res.body), 'COUPON_EXPIRED');
});

test('total usage limit blocks, cancellation frees it', async () => {
  const token = await login('promo-e@test.dev');
  const staff = await login('promo-staff@test.dev');
  await clearCart(token);
  await addToCart(token, products.x250.id, 1);

  const res = await checkoutOrder(token, { couponCode: 'ONCE1' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const orderNo = (res.body.data as { orderNo: string }).orderNo;

  // Limit of 1 is now consumed — preview sees it immediately.
  await addToCart(token, products.x250.id, 1);
  const blocked = await preview(token, { couponCode: 'ONCE1' });
  assert.equal(blocked.status, 400);
  assert.equal(errorCode(blocked.body), 'COUPON_USAGE_LIMIT_REACHED');

  // Pre-shipment cancellation releases the redemption…
  const cancel = await api('PATCH', `/api/employee/orders/${orderNo}/status`, {
    token: staff,
    body: { status: 'cancelled', reason: 'Khách đổi ý' },
  });
  assert.equal(cancel.status, 200, JSON.stringify(cancel.body));

  const redemption = await redemptionFor(orderNo);
  assert.equal(redemption!.status, 'released');
  assert.ok(redemption!.releasedAt, 'releasedAt is stamped');

  // …and the usage limit is free again.
  const freed = await preview(token, { couponCode: 'ONCE1' });
  assert.equal(freed.status, 200, JSON.stringify(freed.body));
  assert.equal(
    (freed.body.data as { totals: { discountAmount: number } }).totals.discountAmount,
    25_000,
  );

  await clearCart(token);
});

test('per-customer usage limit blocks only that customer', async () => {
  const token = await login('promo-f@test.dev');
  const other = await login('promo-a@test.dev');
  await clearCart(token);
  await addToCart(token, products.x250.id, 1);

  const res = await checkoutOrder(token, { couponCode: 'ONCEME' });
  assert.equal(res.status, 201, JSON.stringify(res.body));

  await addToCart(token, products.x250.id, 1);
  const blocked = await preview(token, { couponCode: 'ONCEME' });
  assert.equal(blocked.status, 400);
  assert.equal(errorCode(blocked.body), 'COUPON_CUSTOMER_LIMIT_REACHED');

  // Another customer is unaffected.
  await clearCart(other);
  await addToCart(other, products.x250.id, 1);
  const ok = await preview(other, { couponCode: 'ONCEME' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  await clearCart(other);
});

// ---------- Ordering: free shipping on discounted subtotal ----------

test('tier free shipping is measured after the coupon, before points', async () => {
  const token = await login('promo-c@test.dev'); // SILVER, threshold 500k
  await clearCart(token);
  await addToCart(token, products.x300.id, 1); // 300k brand X
  await addToCart(token, products.y250.id, 1); // 250k brand Y → subtotal 550k

  const plain = await preview(token);
  const plainTotals = (plain.body.data as { totals: { shippingFee: number } }).totals;
  assert.equal(plainTotals.shippingFee, 0, 'SILVER frees shipping at 550k');

  const withCoupon = await preview(token, { couponCode: 'BRAND20' });
  const totals = (
    withCoupon.body.data as { totals: { discountAmount: number; shippingFee: number } }
  ).totals;
  assert.equal(totals.discountAmount, 60_000);
  assert.equal(totals.shippingFee, 30_000, '550k − 60k = 490k drops below the tier threshold');
});

// ---------- Snapshot integrity + admin usage view ----------

test('editing/soft-deleting the promotion+coupon never rewrites a historical order', async () => {
  const token = await login('promo-a@test.dev');
  const admin = await login('promo-admin@test.dev');
  await clearCart(token);
  await addToCart(token, products.x250.id, 1);

  const res = await checkoutOrder(token, { couponCode: 'SNAP10' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.data as { orderNo: string };
  assert.equal((await redemptionFor(order.orderNo))!.status, 'applied');

  // Edit the promotion rule and soft-delete the coupon afterwards.
  const patched = await api('PATCH', `/api/admin/promotions/${promotionIds.snap}`, {
    token: admin,
    body: { discountValue: 90 },
  });
  assert.equal(patched.status, 200);
  const deleted = await api('DELETE', `/api/admin/coupons/${couponIds.SNAP10}`, { token: admin });
  assert.equal(deleted.status, 200);

  const detail = await api('GET', `/api/orders/${order.orderNo}`, { token });
  assert.equal(detail.status, 200);
  const totals = (
    detail.body.data as {
      totals: {
        discountAmount: number;
        couponRef: { code: string; discountValue: number; promotionId: string };
      };
    }
  ).totals;
  assert.equal(totals.couponRef.code, 'SNAP10', 'deleted coupon still renders its code');
  assert.equal(totals.couponRef.discountValue, 10, 'snapshot keeps the rule at checkout time');
  assert.equal(totals.couponRef.promotionId, promotionIds.snap);
  assert.equal(totals.discountAmount, 25_000);

  // The code itself is released: a new lookup behaves like an unknown code.
  await clearCart(token);
  await addToCart(token, products.x250.id, 1);
  const gone = await preview(token, { couponCode: 'SNAP10' });
  assert.equal(gone.status, 400);
  assert.equal(errorCode(gone.body), 'COUPON_NOT_FOUND');
});

test('admin usage view exposes counts and per-coupon redemptions', async () => {
  const admin = await login('promo-admin@test.dev');

  const list = await api('GET', '/api/admin/coupons?limit=48', { token: admin });
  assert.equal(list.status, 200);
  const items = list.body.data as Array<{
    id: string;
    code: string;
    usageCount: number;
    promotionName: string;
  }>;
  const cap10 = items.find((coupon) => coupon.id === couponIds.CAP10);
  assert.ok(cap10, 'CAP10 is listed');
  assert.equal(cap10!.usageCount, 1, 'one applied redemption so far');
  assert.equal(cap10!.promotionName, 'Promo cap');

  // Soft-deleted coupons only appear under status=deleted, but their usage
  // count still reflects the applied redemption on the historical order.
  const deletedList = await api('GET', '/api/admin/coupons?status=deleted&limit=48', {
    token: admin,
  });
  const snap10 = (deletedList.body.data as typeof items).find(
    (coupon) => coupon.id === couponIds.SNAP10,
  );
  assert.equal(snap10!.usageCount, 1, 'the deleted coupon keeps its applied row');

  const redemptions = await api('GET', `/api/admin/coupons/${couponIds.CAP10}/redemptions`, {
    token: admin,
  });
  assert.equal(redemptions.status, 200);
  const rows = redemptions.body.data as Array<{
    orderNo: string;
    code: string;
    status: string;
    discountAmount: number;
  }>;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, 'CAP10');
  assert.equal(rows[0].status, 'applied');
  assert.equal(rows[0].discountAmount, 50_000);

  // Released redemptions stay visible in history but no longer count.
  const cancelList = await api('GET', `/api/admin/coupons/${couponIds.ONCE1}/redemptions`, {
    token: admin,
  });
  const cancelRows = cancelList.body.data as Array<{ status: string }>;
  assert.equal(cancelRows[0].status, 'released');
});
