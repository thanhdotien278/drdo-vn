import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

/**
 * Epic 3 integration checks — cart, addresses, checkout, customer orders,
 * and inventory reservation against a real MongoDB test database.
 * Requires MongoDB running (same as `npm run seed`); override with
 * MONGODB_TEST_URI.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI = process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:27017/drdo_vn_test';

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

interface TestProduct {
  id: string;
  sku: string;
  price: number;
  stockOnHand: number;
}

const products: Record<string, TestProduct> = {};

const SHIPPING = {
  fullName: 'Nguyễn Thị Test',
  phone: '0912345678',
  line1: '12 Đường Test',
  ward: 'Phường Test',
  district: 'Quận Test',
  province: 'TP. Hồ Chí Minh',
};

async function addToCart(token: string, productId: string, qty: number) {
  return api('POST', '/api/cart/items', { token, body: { productId, qty } });
}

async function checkoutOrder(token: string, extra: Record<string, unknown> = {}) {
  return api('POST', '/api/orders', {
    token,
    body: { paymentMethod: 'cod', shipping: SHIPPING, ...extra },
  });
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
    ProductModel.deleteMany({}),
    BrandModel.deleteMany({}),
    CategoryModel.deleteMany({}),
  ]);

  const passwordHash = await hashPassword(PASSWORD);
  for (const email of ['cust-a@test.dev', 'cust-b@test.dev', 'cust-c@test.dev']) {
    await UserModel.create({
      email,
      passwordHash,
      fullName: `Test ${email}`,
      roles: ['customer'],
      status: 'active',
    });
  }
  await UserModel.create({
    email: 'staff@test.dev',
    passwordHash,
    fullName: 'Test Staff',
    roles: ['employee'],
    status: 'active',
  });

  const brand = await BrandModel.create({ name: 'Test Brand', slug: 'test-brand' });
  const category = await CategoryModel.create({ name: 'Test Category', slug: 'test-category' });

  const seeds: Array<[string, number, number, boolean]> = [
    // key, price, stockOnHand, isActive
    ['serum', 350_000, 10, true],
    ['toner', 220_000, 3, true],
    ['retired', 150_000, 5, false],
  ];
  for (const [key, price, stockOnHand, isActive] of seeds) {
    const product = await ProductModel.create({
      name: `Test ${key}`,
      slug: `test-${key}`,
      sku: `TST-${key.toUpperCase()}`,
      price,
      stockOnHand,
      category: category._id,
      brand: brand._id,
      isActive,
    });
    products[key] = {
      id: String(product._id),
      sku: product.sku,
      price,
      stockOnHand,
    };
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

// ---------- Auth/RBAC ----------

test('anonymous requests to cart/address/order APIs return 401', async () => {
  for (const [method, path] of [
    ['GET', '/api/cart'],
    ['POST', '/api/cart/items'],
    ['GET', '/api/addresses'],
    ['POST', '/api/addresses'],
    ['GET', '/api/orders'],
    ['POST', '/api/orders'],
    ['POST', '/api/orders/preview'],
  ] as const) {
    const res = await api(method, path, method === 'GET' ? {} : { body: {} });
    assert.equal(res.status, 401, `${method} ${path} should reject anonymous requests`);
  }
});

test('employee cannot use customer cart/address/order APIs (403)', async () => {
  const token = await login('staff@test.dev');
  for (const [method, path] of [
    ['GET', '/api/cart'],
    ['POST', '/api/cart/items'],
    ['GET', '/api/addresses'],
    ['GET', '/api/orders'],
    ['POST', '/api/orders'],
  ] as const) {
    const res = await api(method, path, method === 'GET' ? { token } : { token, body: {} });
    assert.equal(res.status, 403, `${method} ${path} should reject employees`);
  }
});

// ---------- Story 3.1/3.2: cart ----------

test('add to cart creates one persistent cart; same product merges quantity', async () => {
  const token = await login('cust-a@test.dev');

  const first = await addToCart(token, products.serum.id, 1);
  assert.equal(first.status, 201);
  let cart = first.body.data as { items: unknown[]; subtotal: number; itemCount: number };
  assert.equal(cart.items.length, 1);
  assert.equal(cart.subtotal, products.serum.price);
  assert.equal(cart.itemCount, 1);

  const merged = await addToCart(token, products.serum.id, 2);
  cart = merged.body.data as typeof cart;
  assert.equal(cart.items.length, 1, 'same product must merge instead of duplicating');
  assert.equal((cart.items[0] as { qty: number }).qty, 3);
  assert.equal(cart.subtotal, products.serum.price * 3);

  const persisted = await api('GET', '/api/cart', { token });
  assert.equal((persisted.body.data as typeof cart).itemCount, 3);
});

test('cart rejects inactive products and quantity above available stock', async () => {
  const token = await login('cust-a@test.dev');

  const inactive = await addToCart(token, products.retired.id, 1);
  assert.equal(inactive.status, 400);
  assert.equal(errorCode(inactive.body), 'PRODUCT_UNAVAILABLE');

  const overStock = await addToCart(token, products.toner.id, 99);
  assert.equal(overStock.status, 400);
  assert.equal(errorCode(overStock.body), 'INSUFFICIENT_STOCK');

  // Merged quantity above stock is also rejected.
  await addToCart(token, products.toner.id, 2);
  const overMerge = await addToCart(token, products.toner.id, 2);
  assert.equal(overMerge.status, 400);
  assert.equal(errorCode(overMerge.body), 'INSUFFICIENT_STOCK');
});

test('update quantity and remove item recalculate totals', async () => {
  const token = await login('cust-a@test.dev');
  const cart = (await api('GET', '/api/cart', { token })).body.data as {
    items: Array<{ id: string; qty: number }>;
  };
  const tonerItem = cart.items.find((item) => item.qty === 2)!;

  const updated = await api('PATCH', `/api/cart/items/${tonerItem.id}`, { token, body: { qty: 3 } });
  assert.equal(updated.status, 200);
  const updatedCart = updated.body.data as { subtotal: number; itemCount: number };
  assert.equal(updatedCart.subtotal, products.serum.price * 3 + products.toner.price * 3);

  const removed = await api('DELETE', `/api/cart/items/${tonerItem.id}`, { token });
  assert.equal(removed.status, 200);
  const afterCart = removed.body.data as { subtotal: number; items: unknown[] };
  assert.equal(afterCart.items.length, 1);
  assert.equal(afterCart.subtotal, products.serum.price * 3);
});

test('customer B cannot touch customer A cart items', async () => {
  const tokenA = await login('cust-a@test.dev');
  const tokenB = await login('cust-b@test.dev');
  const cart = (await api('GET', '/api/cart', { token: tokenA })).body.data as {
    items: Array<{ id: string }>;
  };
  const itemId = cart.items[0].id;

  assert.equal((await api('PATCH', `/api/cart/items/${itemId}`, { token: tokenB, body: { qty: 1 } })).status, 404);
  assert.equal((await api('DELETE', `/api/cart/items/${itemId}`, { token: tokenB })).status, 404);
});

// ---------- Story 3.3: addresses ----------

test('address CRUD: first address becomes default; only one default at a time', async () => {
  const token = await login('cust-a@test.dev');

  const first = await api('POST', '/api/addresses', {
    token,
    body: { ...SHIPPING, fullName: 'Địa chỉ một' },
  });
  assert.equal(first.status, 201);
  const firstAddress = first.body.data as { id: string; isDefault: boolean };
  assert.equal(firstAddress.isDefault, true);

  const second = await api('POST', '/api/addresses', {
    token,
    body: { ...SHIPPING, fullName: 'Địa chỉ hai' },
  });
  assert.equal(second.status, 201);
  const secondAddress = second.body.data as { id: string; isDefault: boolean };
  assert.equal(secondAddress.isDefault, false);

  const setDefault = await api('PATCH', `/api/addresses/${secondAddress.id}/default`, { token });
  assert.equal(setDefault.status, 200);

  const list = await api('GET', '/api/addresses', { token });
  const addresses = list.body.data as Array<{ id: string; isDefault: boolean }>;
  assert.equal(addresses.filter((address) => address.isDefault).length, 1);
  assert.equal(addresses.find((address) => address.isDefault)?.id, secondAddress.id);

  const edited = await api('PATCH', `/api/addresses/${firstAddress.id}`, {
    token,
    body: { line1: '99 Đường Mới' },
  });
  assert.equal(edited.status, 200);
  assert.equal((edited.body.data as { line1: string }).line1, '99 Đường Mới');
});

test('customer B cannot read/update/delete customer A addresses', async () => {
  const tokenA = await login('cust-a@test.dev');
  const tokenB = await login('cust-b@test.dev');
  const list = await api('GET', '/api/addresses', { token: tokenA });
  const addressId = (list.body.data as Array<{ id: string }>)[0].id;

  assert.equal(
    (await api('PATCH', `/api/addresses/${addressId}`, { token: tokenB, body: { line1: 'x' } })).status,
    404,
  );
  assert.equal((await api('DELETE', `/api/addresses/${addressId}`, { token: tokenB })).status, 404);
  assert.equal(
    (await api('PATCH', `/api/addresses/${addressId}/default`, { token: tokenB })).status,
    404,
  );
});

// ---------- Story 3.4/3.6: checkout + reservation ----------

test('checkout with an empty cart is rejected', async () => {
  const token = await login('cust-b@test.dev');
  const res = await checkoutOrder(token);
  assert.equal(res.status, 400);
  assert.equal(errorCode(res.body), 'CART_EMPTY');
});

test('checkout creates a pending/unpaid order, reserves stock, clears cart', async () => {
  const token = await login('cust-a@test.dev');
  const { ProductModel } = await import('../../models/Product.js');

  // Ignores client-supplied prices/totals entirely.
  const res = await checkoutOrder(token, {
    totals: { grandTotal: 1 },
    items: [{ productId: products.serum.id, qty: 1, unitPrice: 1 }],
    notesCustomer: 'Gọi trước khi giao',
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));

  const order = res.body.data as {
    orderNo: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod: string;
    paidAt: string | null;
    items: Array<{ sku: string; unitPrice: number; qty: number; lineTotal: number; name: string }>;
    totals: {
      subtotal: number;
      discountAmount: number;
      couponRef: unknown;
      pointsRedeemed: number;
      pointsDiscountAmount: number;
      shippingFee: number;
      grandTotal: number;
    };
    shipping: Record<string, string>;
    timeline: Array<{ fromStatus: string | null; toStatus: string }>;
  };

  assert.match(order.orderNo, /^DRD-\d{8}-\d{4}$/);
  const vnToday = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    .replace(/-/g, '');
  assert.equal(order.orderNo.slice(4, 12), vnToday, 'date part is the Vietnam calendar day');
  assert.equal(order.orderStatus, 'pending');
  assert.equal(order.paymentStatus, 'unpaid');
  assert.equal(order.paidAt, null);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].sku, products.serum.sku);
  assert.equal(order.items[0].unitPrice, products.serum.price, 'order must use the server price');
  assert.equal(order.items[0].qty, 3);
  assert.equal(order.items[0].lineTotal, products.serum.price * 3);
  assert.equal(order.totals.subtotal, products.serum.price * 3);
  assert.equal(order.totals.shippingFee, 30_000);
  assert.equal(order.totals.grandTotal, products.serum.price * 3 + 30_000);
  assert.equal(order.totals.discountAmount, 0);
  assert.equal(order.totals.couponRef, null);
  assert.equal(order.shipping.fullName, SHIPPING.fullName);
  assert.equal(order.shipping.province, SHIPPING.province);
  assert.equal(order.timeline.length, 1);
  assert.deepEqual(order.timeline[0].fromStatus, null);
  assert.equal(order.timeline[0].toStatus, 'pending');

  const product = await ProductModel.findById(products.serum.id).exec();
  assert.equal(product!.stockReserved, 3, 'checkout reserves stock');
  assert.equal(product!.stockOnHand, products.serum.stockOnHand, 'stock on hand is untouched');
  assert.equal(product!.availableStock, products.serum.stockOnHand - 3);

  const cart = (await api('GET', '/api/cart', { token })).body.data as { items: unknown[] };
  assert.equal(cart.items.length, 0, 'cart clears after order creation');
});

test('checkout via a saved address snapshots shipping; later edits do not affect the order', async () => {
  const token = await login('cust-b@test.dev');
  await addToCart(token, products.toner.id, 1);

  const address = await api('POST', '/api/addresses', { token, body: SHIPPING });
  const addressId = (address.body.data as { id: string }).id;

  const res = await checkoutOrder(token, { addressId, contactEmail: 'cust-b@test.dev' });
  assert.equal(res.status, 201);
  const order = res.body.data as { orderNo: string; shipping: Record<string, string> };
  assert.equal(order.shipping.line1, SHIPPING.line1);

  // Edit + delete the address afterwards: the snapshot must not change.
  await api('PATCH', `/api/addresses/${addressId}`, { token, body: { line1: 'ĐỔI ĐỊA CHỈ' } });
  const detail = await api('GET', `/api/orders/${order.orderNo}`, { token });
  assert.equal((detail.body.data as { shipping: Record<string, string> }).shipping.line1, SHIPPING.line1);
});

test('checkout revalidates stock at order creation time', async () => {
  const token = await login('cust-b@test.dev');
  const { ProductModel } = await import('../../models/Product.js');

  // The cart accepts the item while stock is available…
  assert.equal((await addToCart(token, products.toner.id, 1)).status, 201);

  // …then another buyer reserves everything before this checkout completes.
  await ProductModel.updateOne(
    { _id: products.toner.id },
    { $set: { stockReserved: products.toner.stockOnHand, availableStock: 0 } },
  ).exec();

  const res = await checkoutOrder(token);
  assert.equal(res.status, 400);
  assert.equal(errorCode(res.body), 'INSUFFICIENT_STOCK');

  // The failed checkout must not clear the cart or leave an order behind.
  const cart = (await api('GET', '/api/cart', { token })).body.data as { items: unknown[] };
  assert.equal(cart.items.length, 1);

  await clearCustomerBCart();
});

async function clearCustomerBCart(): Promise<void> {
  const { CartItemModel } = await import('../../models/CartItem.js');
  const { CartModel } = await import('../../models/Cart.js');
  const { UserModel } = await import('../../models/User.js');
  const user = await UserModel.findOne({ email: 'cust-b@test.dev' }).exec();
  const cart = await CartModel.findOne({ userId: user!._id }).exec();
  if (cart) {
    await CartItemModel.deleteMany({ cartId: cart._id }).exec();
  }
}

// ---------- Story 3.5: customer orders ----------

test('order list shows only own orders, newest first; detail exposes everything', async () => {
  const tokenA = await login('cust-a@test.dev');
  const tokenB = await login('cust-b@test.dev');

  const listA = await api('GET', '/api/orders', { token: tokenA });
  const ordersA = listA.body.data as Array<{ orderNo: string; grandTotal: number; itemCount: number }>;
  assert.equal(ordersA.length, 1);
  assert.equal(ordersA[0].itemCount, 3);

  const listB = await api('GET', '/api/orders', { token: tokenB });
  const ordersB = listB.body.data as Array<{ orderNo: string; createdAt: string }>;
  assert.equal(ordersB.length, 1, 'the failed checkout left no order');

  // Customer B cannot read customer A's order.
  const foreign = await api('GET', `/api/orders/${ordersA[0].orderNo}`, { token: tokenB });
  assert.equal(foreign.status, 404);

  const detail = await api('GET', `/api/orders/${ordersA[0].orderNo}`, { token: tokenA });
  const order = detail.body.data as {
    items: unknown[];
    totals: { grandTotal: number };
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    shipping: Record<string, string>;
    timeline: unknown[];
  };
  assert.equal(order.items.length, 1);
  assert.equal(order.paymentMethod, 'cod');
  assert.equal(order.paymentStatus, 'unpaid');
  assert.equal(order.orderStatus, 'pending');
  assert.equal(order.timeline.length, 1);
});

test('customers have no API to mutate order/payment status', async () => {
  const token = await login('cust-a@test.dev');
  const orders = (await api('GET', '/api/orders', { token })).body.data as Array<{ orderNo: string }>;
  const orderNo = orders[0].orderNo;
  for (const [method, path] of [
    ['PATCH', `/api/orders/${orderNo}/status`],
    ['PATCH', `/api/orders/${orderNo}/payment`],
    ['PATCH', `/api/orders/${orderNo}`],
    ['DELETE', `/api/orders/${orderNo}`],
  ] as const) {
    const res = await api(method, path, { token, body: {} });
    assert.equal(res.status, 404, `${method} ${path} must not exist for customers`);
  }
});

// ---------- Story 3.6: cancellation release ----------

test('pre-shipment cancellation releases the reservation exactly once', async () => {
  const token = await login('cust-a@test.dev');
  const { ProductModel } = await import('../../models/Product.js');
  const { OrderModel } = await import('../../models/Order.js');
  const { releaseOrderReservation } = await import('./inventory.js');

  await addToCart(token, products.serum.id, 2);
  const res = await checkoutOrder(token);
  assert.equal(res.status, 201);
  const orderId = (res.body.data as { id: string }).id;

  const before = await ProductModel.findById(products.serum.id).exec();
  assert.equal(before!.stockReserved, 3 + 2);

  assert.equal(await releaseOrderReservation(orderId), true);
  const after = await ProductModel.findById(products.serum.id).exec();
  assert.equal(after!.stockReserved, 3, 'reserved stock returns to the pool');
  assert.equal(after!.stockOnHand, products.serum.stockOnHand);

  const order = await OrderModel.findById(orderId).exec();
  assert.equal(order!.inventoryState, 'released');

  // Exactly-once: a second release is a no-op, not another stock increment.
  assert.equal(await releaseOrderReservation(orderId), false);
  const final = await ProductModel.findById(products.serum.id).exec();
  assert.equal(final!.stockReserved, 3);
});

// ---------- Checkout "save this address" opt-in ----------

test('checkout with saveAddress persists the address; first saved address is default', async () => {
  const token = await login('cust-c@test.dev');
  await addToCart(token, products.serum.id, 1);

  const res = await api('POST', '/api/orders', {
    token,
    body: { paymentMethod: 'cod', shipping: SHIPPING, saveAddress: true },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(
    (res.body.data as { addressSaved?: boolean }).addressSaved,
    true,
    'the opt-in address save is reported in the checkout response',
  );

  const list = await api('GET', '/api/addresses', { token });
  const addresses = list.body.data as Array<{ isDefault: boolean; line1: string; phone: string }>;
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].isDefault, true, 'first saved address becomes default');
  assert.equal(addresses[0].line1, SHIPPING.line1);
});

test('checkout without saveAddress does not write to the address book', async () => {
  const token = await login('cust-c@test.dev');
  await addToCart(token, products.serum.id, 1);

  const res = await api('POST', '/api/orders', {
    token,
    body: { paymentMethod: 'cod', shipping: { ...SHIPPING, line1: 'Không Lưu' } },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(
    (res.body.data as { addressSaved?: boolean }).addressSaved,
    false,
    'no opt-in means nothing was saved',
  );

  const list = await api('GET', '/api/addresses', { token });
  const addresses = list.body.data as Array<{ line1: string }>;
  assert.equal(addresses.length, 1, 'still only the previously saved address');
  assert.equal(addresses[0].line1, SHIPPING.line1);
});

test('profile name/phone updates never touch order shipping snapshots', async () => {
  const token = await login('cust-c@test.dev');
  const orders = (await api('GET', '/api/orders', { token })).body.data as Array<{
    orderNo: string;
  }>;
  const orderNo = orders[0].orderNo;

  const before = await api('GET', `/api/orders/${orderNo}`, { token });
  const beforeShipping = (before.body.data as { shipping: Record<string, string> }).shipping;

  const update = await api('PATCH', '/api/auth/me', {
    token,
    body: { fullName: 'Tên Mới Hoàn Toàn', phone: '0909000111' },
  });
  assert.equal(update.status, 200);

  const after = await api('GET', `/api/orders/${orderNo}`, { token });
  const afterShipping = (after.body.data as { shipping: Record<string, string> }).shipping;
  assert.deepEqual(afterShipping, beforeShipping);
  assert.equal(afterShipping.fullName, SHIPPING.fullName);
});
