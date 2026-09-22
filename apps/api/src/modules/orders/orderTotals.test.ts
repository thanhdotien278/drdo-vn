import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Schema, model } from 'mongoose';
import { ApiError } from '../../utils/apiError.js';
import { computeOrderTotals, orderTotalsSchema, POINT_VALUE_VND } from './orderTotals.js';

const EXPECTED_FIELDS = [
  'subtotal',
  'discountAmount',
  'couponRef',
  'pointsRedeemed',
  'pointsDiscountAmount',
  'shippingFee',
  'grandTotal',
];

test('stores exactly the seven totals fields even when zero', () => {
  const harnessSchema = new Schema({ totals: orderTotalsSchema });
  const Harness = model('OrderTotalsHarness', harnessSchema);

  const totals = new Harness({ totals: {} }).toObject().totals as Record<string, unknown>;
  assert.deepEqual(Object.keys(totals).sort(), [...EXPECTED_FIELDS].sort());
  assert.equal(totals.subtotal, 0);
  assert.equal(totals.discountAmount, 0);
  assert.equal(totals.couponRef, null);
  assert.equal(totals.pointsRedeemed, 0);
  assert.equal(totals.pointsDiscountAmount, 0);
  assert.equal(totals.shippingFee, 0);
  assert.equal(totals.grandTotal, 0);
});

test('computed totals satisfy the embedded schema validation', async () => {
  const harnessSchema = new Schema({ totals: orderTotalsSchema });
  const Harness = model('OrderTotalsHarnessValidate', harnessSchema);

  const totals = computeOrderTotals({
    lineItems: [{ lineTotal: 150_000 }, { lineTotal: 250_000 }],
    discountAmount: 20_000,
    couponRef: {
      couponId: null,
      code: 'SALE10',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscountAmount: 50_000,
    },
    pointsRedeemed: 200,
    shippingFee: 30_000,
  });

  await new Harness({ totals }).validate();
});

test('computes grandTotal = subtotal - discount - points discount + shipping', () => {
  const totals = computeOrderTotals({
    lineItems: [{ lineTotal: 150_000 }, { lineTotal: 250_000 }],
    discountAmount: 20_000,
    pointsRedeemed: 200,
    shippingFee: 30_000,
  });

  assert.equal(totals.subtotal, 400_000);
  assert.equal(totals.discountAmount, 20_000);
  assert.equal(totals.couponRef, null);
  assert.equal(totals.pointsRedeemed, 200);
  assert.equal(totals.pointsDiscountAmount, 200 * POINT_VALUE_VND);
  assert.equal(totals.shippingFee, 30_000);
  assert.equal(totals.grandTotal, 400_000 - 20_000 - 2_000 + 30_000);
});

test('clamps grandTotal at 0 when discounts exceed the payable amount', () => {
  const totals = computeOrderTotals({
    lineItems: [{ lineTotal: 100_000 }],
    discountAmount: 100_000,
    pointsRedeemed: 5_000,
    shippingFee: 30_000,
  });

  assert.equal(totals.grandTotal, 0);
});

test('keeps the coupon snapshot immutable on the totals block', () => {
  const totals = computeOrderTotals({
    lineItems: [{ lineTotal: 100_000 }],
    discountAmount: 10_000,
    couponRef: {
      couponId: '507f1f77bcf86cd799439011',
      code: 'VIP20',
      discountType: 'fixed_amount',
      discountValue: 10_000,
      maxDiscountAmount: null,
    },
  });

  assert.deepEqual(totals.couponRef, {
    couponId: '507f1f77bcf86cd799439011',
    code: 'VIP20',
    discountType: 'fixed_amount',
    discountValue: 10_000,
    maxDiscountAmount: null,
  });
});

test('rejects negative money inputs instead of trusting them', () => {
  assert.throws(
    () => computeOrderTotals({ lineItems: [{ lineTotal: -1 }] }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
  assert.throws(
    () => computeOrderTotals({ lineItems: [{ lineTotal: 10 }], discountAmount: -5 }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});

test('rejects an invalid coupon snapshot', () => {
  assert.throws(
    () =>
      computeOrderTotals({
        lineItems: [{ lineTotal: 10 }],
        couponRef: {
          couponId: null,
          code: '',
          discountType: 'percentage',
          discountValue: 10,
          maxDiscountAmount: null,
        },
      }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});
