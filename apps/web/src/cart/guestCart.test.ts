import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { ApiRequestError } from '../api/client';
import type { CartProduct } from '../types/commerce';
import {
  addGuestItem,
  guestCart,
  mergeGuestCart,
  readGuestEntries,
  removeGuestItem,
  updateGuestItem,
} from './guestCart';

/**
 * Guest cart (localStorage) + login-merge checks. `window.localStorage` is
 * stubbed with an in-memory map so the suite runs under plain `tsx --test`.
 */

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
};

function product(id: string, price: number, stock = 10): CartProduct {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    sku: `SKU-${id}`,
    imageUrl: '',
    imageAlt: '',
    effectivePrice: price,
    availableStock: stock,
    inStock: stock > 0,
    purchasable: true,
  };
}

beforeEach(() => store.clear());

test('guest adds multiple products; same product merges qty; survives reload', () => {
  let cart = addGuestItem(product('a', 100_000), 2);
  cart = addGuestItem(product('b', 50_000), 1);
  cart = addGuestItem(product('a', 100_000), 1);

  assert.equal(cart.items.length, 2);
  assert.equal(cart.itemCount, 4);
  assert.equal(cart.subtotal, 350_000);
  assert.equal(cart.items[0].qty, 3, 'same product merges instead of duplicating');

  // Simulated page refresh: state comes back from localStorage.
  const reloaded = guestCart();
  assert.deepEqual(reloaded.items, cart.items);
  assert.equal(reloaded.itemCount, 4);
});

test('guest updates quantity and removes items', () => {
  addGuestItem(product('a', 100_000), 2);
  addGuestItem(product('b', 50_000), 1);

  const updated = updateGuestItem('a', 5);
  assert.equal(updated.items[0].qty, 5);
  assert.equal(updated.subtotal, 550_000);

  const removed = removeGuestItem('b');
  assert.equal(removed.items.length, 1);
  assert.equal(removed.itemCount, 5);
});

test('guest cart rejects quantity above available stock', () => {
  assert.throws(() => addGuestItem(product('a', 100_000, 2), 3), (err: unknown) => {
    assert.ok(err instanceof ApiRequestError);
    assert.equal(err.code, 'INSUFFICIENT_STOCK');
    return true;
  });
});

test('login merge replays guest items into the customer cart and clears storage', async () => {
  addGuestItem(product('a', 100_000), 2);
  addGuestItem(product('b', 50_000), 1);

  const serverCart: Array<{ productId: string; qty: number }> = [];
  await mergeGuestCart(async (p, qty) => {
    const existing = serverCart.find((item) => item.productId === p.id);
    if (existing) existing.qty += qty;
    else serverCart.push({ productId: p.id, qty });
  });

  assert.deepEqual(serverCart, [
    { productId: 'a', qty: 2 },
    { productId: 'b', qty: 1 },
  ]);
  assert.equal(readGuestEntries().length, 0, 'guest cart clears after merge');
});

test('merge drops items the server rejects (400) but keeps them on other failures', async () => {
  addGuestItem(product('a', 100_000), 1);
  addGuestItem(product('b', 50_000), 1);
  addGuestItem(product('c', 75_000), 1);

  // 'a' is now inactive → validation drop. 'c' hit a network error → keep.
  await mergeGuestCart(async (p) => {
    if (p.id === 'a') throw new ApiRequestError(400, 'Sản phẩm không còn kinh doanh', 'PRODUCT_UNAVAILABLE');
    if (p.id === 'c') throw new Error('network down');
  });

  const remaining = readGuestEntries();
  assert.deepEqual(
    remaining.map((entry) => entry.product.id),
    ['c'],
    'validation failures drop, transient failures stay for next login',
  );
});
