import { MembershipTierModel } from '../models/MembershipTier.js';
import { OrderModel } from '../models/Order.js';
import { accrueForOrder } from '../modules/loyalty/loyalty.service.js';

/**
 * Epic 8 — membership tiers plus accrual backfill for shipped seed orders.
 * Idempotent: tiers insert once via `$setOnInsert` so re-runs never clobber
 * admin edits or reactivate a disabled tier, and the accrual ledger's
 * unique partial index on `orderId` makes replays silent no-ops.
 */
const SEED_TIERS = [
  { code: 'BRONZE', name: 'Đồng', minLifetimePoints: 0, earnMultiplier: 1, freeShippingThreshold: null as number | null, displayOrder: 0 },
  { code: 'SILVER', name: 'Bạc', minLifetimePoints: 2000, earnMultiplier: 1.1, freeShippingThreshold: 500_000, displayOrder: 1 },
  { code: 'GOLD', name: 'Vàng', minLifetimePoints: 5000, earnMultiplier: 1.25, freeShippingThreshold: 300_000, displayOrder: 2 },
  { code: 'PLATINUM', name: 'Bạch kim', minLifetimePoints: 15_000, earnMultiplier: 1.5, freeShippingThreshold: 0, displayOrder: 3 },
];

export async function seedLoyalty(): Promise<string> {
  for (const tier of SEED_TIERS) {
    await MembershipTierModel.findOneAndUpdate(
      { code: tier.code },
      { $setOnInsert: { ...tier, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
  }

  let accrued = 0;
  const shippedOrders = await OrderModel.find({ orderStatus: 'shipped' }).exec();
  for (const order of shippedOrders) {
    await accrueForOrder(order);
    accrued += 1;
  }

  return `${SEED_TIERS.length} membership tiers, accrual checked for ${accrued} shipped orders`;
}
