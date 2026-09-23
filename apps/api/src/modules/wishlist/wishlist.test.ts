import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Stories 7.1/7.2 integration checks — wishlist persistence, customer
 * isolation, live product data, hide-without-delete for inactive products,
 * and move-to-cart against a real MongoDB test database.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI =
  process.env.MONGODB_TEST_URI_WISHLIST ?? 'mongodb://127.0.0.1:27017/drdo_vn_test_wishlist';

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

interface WishlistEntry {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    salePrice: number | null;
    effectivePrice: number;
    availableStock: number;
    inStock: boolean;
  };
}

let customerToken = '';
let customer2Token = '';
let employeeToken = '';
let adminToken = '';
let productId = '';
let secondProductId = '';
let emptyProductId = '';

async function wishlistRows(userId: string) {
  const { WishlistItemModel } = await import('../../models/WishlistItem.js');
  return WishlistItemModel.find({ userId }).exec();
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
  const { WishlistItemModel } = await import('../../models/WishlistItem.js');
  const { hashPassword } = await import('../auth/password.js');

  await connectDatabase(TEST_MONGO_URI);
  await Promise.all([
    UserModel.deleteMany({}),
    CartModel.deleteMany({}),
    CartItemModel.deleteMany({}),
    WishlistItemModel.deleteMany({}),
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
    name: 'Serum Wishlist',
    slug: 'serum-wishlist',
    sku: 'WL-SERUM',
    price: 300_000,
    salePrice: 250_000,
    stockOnHand: 10,
    category: category._id,
    brand: brand._id,
    isActive: true,
    images: [{ url: '/uploads/products/wl-serum.svg', alt: 'Serum', isPrimary: true }],
  });
  productId = String(product._id);

  const second = await ProductModel.create({
    name: 'Toner Wishlist',
    slug: 'toner-wishlist',
    sku: 'WL-TONER',
    price: 180_000,
    stockOnHand: 5,
    category: category._id,
    brand: brand._id,
    isActive: true,
  });
  secondProductId = String(second._id);

  const empty = await ProductModel.create({
    name: 'Kem Hết Hàng',
    slug: 'kem-het-hang',
    sku: 'WL-EMPTY',
    price: 150_000,
    stockOnHand: 0,
    category: category._id,
    brand: brand._id,
    isActive: true,
  });
  emptyProductId = String(empty._id);

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

test('anonymous requests to wishlist APIs return 401', async () => {
  for (const [method, path] of [
    ['GET', '/api/wishlist'],
    ['POST', '/api/wishlist/items'],
    ['DELETE', `/api/wishlist/items/${productId}`],
    ['POST', `/api/wishlist/items/${productId}/move-to-cart`],
  ] as const) {
    const res = await api(method, path, method === 'GET' ? {} : { body: {} });
    assert.equal(res.status, 401, `${method} ${path} must reject anonymous`);
  }
});

test('employee and admin tokens get 403 on wishlist APIs', async () => {
  for (const token of [employeeToken, adminToken]) {
    for (const [method, path] of [
      ['GET', '/api/wishlist'],
      ['POST', '/api/wishlist/items'],
      ['DELETE', `/api/wishlist/items/${productId}`],
      ['POST', `/api/wishlist/items/${productId}/move-to-cart`],
    ] as const) {
      const res = await api(method, path, method === 'GET' ? { token } : { token, body: {} });
      assert.equal(res.status, 403, `${method} ${path} must reject staff roles`);
    }
  }
});

// ---------- add / list / remove ----------

test('add then list wishlist returns live product fields', async () => {
  const add = await api('POST', '/api/wishlist/items', {
    token: customerToken,
    body: { productId },
  });
  assert.equal(add.status, 200, JSON.stringify(add.body));

  const list = await api('GET', '/api/wishlist', { token: customerToken });
  assert.equal(list.status, 200);
  const items = list.body.data as WishlistEntry[];
  assert.equal(items.length, 1);
  assert.equal(items[0].product.id, productId);
  assert.equal(items[0].product.name, 'Serum Wishlist');
  assert.equal(items[0].product.slug, 'serum-wishlist');
  assert.equal(items[0].product.price, 300_000);
  assert.equal(items[0].product.salePrice, 250_000);
  assert.equal(items[0].product.effectivePrice, 250_000);
  assert.equal(items[0].product.availableStock, 10);
  assert.equal(items[0].product.inStock, true);
});

test('adding the same product twice is a no-op, not an error or duplicate row', async () => {
  const add = await api('POST', '/api/wishlist/items', {
    token: customerToken,
    body: { productId },
  });
  assert.equal(add.status, 200);
  const items = add.body.data as WishlistEntry[];
  assert.equal(items.length, 1, 'duplicate add must not create a second entry');

  const user = await (await import('../../models/User.js')).UserModel.findOne({
    email: 'cust@test.dev',
  }).exec();
  assert.equal((await wishlistRows(String(user!._id))).length, 1);
});

test('wishlist is isolated per customer', async () => {
  const other = await api('GET', '/api/wishlist', { token: customer2Token });
  assert.equal(other.status, 200);
  assert.equal((other.body.data as WishlistEntry[]).length, 0);

  // Customer 2 cannot remove customer 1's entry — their own lookup misses.
  const del = await api('DELETE', `/api/wishlist/items/${productId}`, { token: customer2Token });
  assert.equal(del.status, 404);
  const mine = await api('GET', '/api/wishlist', { token: customerToken });
  assert.equal((mine.body.data as WishlistEntry[]).length, 1);
});

test('inactive product is hidden but the wishlist row is retained and reappears', async () => {
  const { ProductModel } = await import('../../models/Product.js');
  const user = await (await import('../../models/User.js')).UserModel.findOne({
    email: 'cust@test.dev',
  }).exec();

  await ProductModel.updateOne({ _id: productId }, { $set: { isActive: false } }).exec();
  const hidden = await api('GET', '/api/wishlist', { token: customerToken });
  assert.equal((hidden.body.data as WishlistEntry[]).length, 0, 'inactive product hidden');
  assert.equal(
    (await wishlistRows(String(user!._id))).length,
    1,
    'row must survive the product going inactive',
  );

  await ProductModel.updateOne({ _id: productId }, { $set: { isActive: true } }).exec();
  const back = await api('GET', '/api/wishlist', { token: customerToken });
  assert.equal((back.body.data as WishlistEntry[]).length, 1, 'reactivated product reappears');
});

test('wishlist resolves current price and stock, not stale snapshots', async () => {
  const { ProductModel } = await import('../../models/Product.js');
  const product = await ProductModel.findById(productId).exec();
  assert.ok(product);
  // save() runs syncDerivedFields so the persisted effectivePrice/availableStock update.
  product.price = 400_000;
  product.salePrice = null;
  product.stockOnHand = 3;
  await product.save();

  const list = await api('GET', '/api/wishlist', { token: customerToken });
  const item = (list.body.data as WishlistEntry[])[0];
  assert.equal(item.product.price, 400_000);
  assert.equal(item.product.effectivePrice, 400_000);
  assert.equal(item.product.availableStock, 3);

  product.price = 300_000;
  product.salePrice = 250_000;
  product.stockOnHand = 10;
  await product.save();
});

test('add rejects unknown/deleted products and malformed ids', async () => {
  const missing = await api('POST', '/api/wishlist/items', {
    token: customerToken,
    body: { productId: '000000000000000000000000' },
  });
  assert.equal(missing.status, 400);
  assert.equal(errorCode(missing.body), 'PRODUCT_UNAVAILABLE');

  const malformed = await api('POST', '/api/wishlist/items', {
    token: customerToken,
    body: { productId: 'not-an-id' },
  });
  assert.equal(malformed.status, 404);
});

// ---------- move to cart ----------

test('move to cart adds via the cart service and removes the wishlist row', async () => {
  const move = await api('POST', `/api/wishlist/items/${productId}/move-to-cart`, {
    token: customerToken,
    body: {},
  });
  assert.equal(move.status, 200, JSON.stringify(move.body));
  const data = move.body.data as {
    wishlist: WishlistEntry[];
    cart: { items: Array<{ product: { id: string } | null; qty: number; unitPrice: number }> };
  };
  assert.equal(data.wishlist.length, 0);
  assert.equal(data.cart.items.length, 1);
  assert.equal(data.cart.items[0].product?.id, productId);
  assert.equal(data.cart.items[0].qty, 1);
  assert.equal(data.cart.items[0].unitPrice ?? 0, 250_000, 'cart uses the live effective price');

  const cartCheck = await api('GET', '/api/cart', { token: customerToken });
  assert.equal((cartCheck.body.data as { itemCount: number }).itemCount, 1);
});

test('a rejected move keeps the wishlist row (out of stock / inactive)', async () => {
  // Wishlist the zero-stock product, then try to move it.
  await api('POST', '/api/wishlist/items', { token: customerToken, body: { productId: emptyProductId } });
  const move = await api('POST', `/api/wishlist/items/${emptyProductId}/move-to-cart`, {
    token: customerToken,
    body: {},
  });
  assert.equal(move.status, 400);
  assert.equal(errorCode(move.body), 'INSUFFICIENT_STOCK');

  const list = await api('GET', '/api/wishlist', { token: customerToken });
  const items = list.body.data as WishlistEntry[];
  assert.ok(
    items.some((entry) => entry.product.id === emptyProductId),
    'failed move must preserve the wishlist row',
  );

  // Same guarantee when the product went inactive after being saved.
  const { ProductModel } = await import('../../models/Product.js');
  await api('POST', '/api/wishlist/items', { token: customerToken, body: { productId: secondProductId } });
  await ProductModel.updateOne({ _id: secondProductId }, { $set: { isActive: false } }).exec();
  const blocked = await api('POST', `/api/wishlist/items/${secondProductId}/move-to-cart`, {
    token: customerToken,
    body: {},
  });
  assert.equal(blocked.status, 400);
  assert.equal(errorCode(blocked.body), 'PRODUCT_UNAVAILABLE');
  const user = await (await import('../../models/User.js')).UserModel.findOne({
    email: 'cust@test.dev',
  }).exec();
  const rows = await wishlistRows(String(user!._id));
  assert.ok(
    rows.some((row) => String(row.productId) === secondProductId),
    'inactive product row is preserved after a failed move',
  );
  await ProductModel.updateOne({ _id: secondProductId }, { $set: { isActive: true } }).exec();
});

test('remove deletes only the caller entry; unknown ids are 404', async () => {
  const del = await api('DELETE', `/api/wishlist/items/${emptyProductId}`, { token: customerToken });
  assert.equal(del.status, 200);
  const items = del.body.data as WishlistEntry[];
  assert.ok(!items.some((entry) => entry.product.id === emptyProductId));

  const again = await api('DELETE', `/api/wishlist/items/${emptyProductId}`, { token: customerToken });
  assert.equal(again.status, 404);

  const malformed = await api('DELETE', '/api/wishlist/items/nope', { token: customerToken });
  assert.equal(malformed.status, 404);
});
