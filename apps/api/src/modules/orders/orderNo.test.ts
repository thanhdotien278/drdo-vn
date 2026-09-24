import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

/**
 * Order-number generation — format DRD-YYYYMMDD-NNNN, Vietnam day key,
 * atomic per-day sequence. Uses dedicated day keys so nothing else in the
 * suite can consume the sequence under test.
 */

process.env.NODE_ENV = 'test';
const TEST_MONGO_URI = process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:27017/drdo_vn_test';

// 2026-01-15 18:30 UTC is already 2026-01-16 01:30 in Asia/Ho_Chi_Minh —
// proves the day key follows Vietnam time, not the server's UTC clock.
const DAY_A_UTC = new Date('2026-01-15T18:30:00Z');
const DAY_A_KEY = '20260116';
const DAY_B_UTC = new Date('2026-01-16T18:30:00Z');
const DAY_B_KEY = '20260117';
const DAY_C_UTC = new Date('2026-01-17T18:30:00Z');
const DAY_C_KEY = '20260118';
const DAY_D_UTC = new Date('2026-01-18T18:30:00Z');
const DAY_D_KEY = '20260119';

before(async () => {
  const { connectDatabase } = await import('../../db/connect.js');
  const { OrderCounterModel } = await import('../../models/OrderCounter.js');
  await connectDatabase(TEST_MONGO_URI);
  await OrderCounterModel.deleteMany({ key: { $in: [DAY_A_KEY, DAY_B_KEY, DAY_C_KEY, DAY_D_KEY] } });
});

after(async () => {
  const { disconnectDatabase } = await import('../../db/connect.js');
  const { OrderCounterModel } = await import('../../models/OrderCounter.js');
  await OrderCounterModel.deleteMany({ key: { $in: [DAY_A_KEY, DAY_B_KEY, DAY_C_KEY, DAY_D_KEY] } });
  await disconnectDatabase();
});

test('orderDayKey follows Asia/Ho_Chi_Minh, not the server timezone', async () => {
  const { orderDayKey } = await import('./orderNo.js');
  assert.equal(orderDayKey(DAY_A_UTC), DAY_A_KEY);
  assert.equal(orderDayKey(DAY_B_UTC), DAY_B_KEY);
});

test('nextOrderNo issues DRD-YYYYMMDD-NNNN with an incrementing sequence', async () => {
  const { nextOrderNo } = await import('./orderNo.js');
  assert.equal(await nextOrderNo(DAY_A_UTC), `DRD-${DAY_A_KEY}-0001`);
  assert.equal(await nextOrderNo(DAY_A_UTC), `DRD-${DAY_A_KEY}-0002`);
  assert.equal(await nextOrderNo(DAY_A_UTC), `DRD-${DAY_A_KEY}-0003`);
});

test('the sequence resets to 0001 on a new Vietnam day', async () => {
  const { nextOrderNo } = await import('./orderNo.js');
  assert.equal(await nextOrderNo(DAY_B_UTC), `DRD-${DAY_B_KEY}-0001`);
  assert.equal(await nextOrderNo(DAY_B_UTC), `DRD-${DAY_B_KEY}-0002`);
});

test('concurrent checkouts never draw the same sequence number', async () => {
  const { nextOrderNo } = await import('./orderNo.js');
  const codes = await Promise.all(Array.from({ length: 20 }, () => nextOrderNo(DAY_C_UTC)));
  assert.equal(new Set(codes).size, codes.length, 'every code must be unique');
  const seqs = codes.map((code) => Number(code.slice(-4))).sort((a, b) => a - b);
  assert.deepEqual(
    seqs,
    Array.from({ length: 20 }, (_, i) => i + 1),
    'the atomic counter hands out 1..20 exactly once',
  );
});

test('orderNo is immutable once the order exists', async () => {
  const { OrderModel } = await import('../../models/Order.js');
  const { nextOrderNo } = await import('./orderNo.js');

  const { Types } = await import('mongoose');
  const order = await OrderModel.create({
    orderNo: await nextOrderNo(DAY_D_UTC),
    userId: new Types.ObjectId(),
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
    orderStatus: 'pending',
    totals: {
      subtotal: 1,
      discountAmount: 0,
      couponRef: null,
      pointsRedeemed: 0,
      pointsDiscountAmount: 0,
      shippingFee: 0,
      grandTotal: 1,
    },
    inventoryState: 'reserved',
    shippingFullName: 'T',
    shippingPhone: '0900000000',
    shippingLine1: 'x',
    shippingWard: 'x',
    shippingDistrict: 'x',
    shippingProvince: 'x',
    contactEmail: 't@t.dev',
  });
  const original = order.orderNo;
  order.orderNo = 'DRD-19990101-9999';
  await order.save();
  assert.equal(
    (await OrderModel.findById(order._id).exec())!.orderNo,
    original,
    'orderNo survives a save that tried to change it',
  );
  await order.deleteOne();
});
