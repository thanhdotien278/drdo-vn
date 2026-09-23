import { seedCatalog } from './catalog.seed.js';
import { seedEngagement } from './engagement.seed.js';
import { seedLoyalty } from './loyalty.seed.js';
import { seedOrders } from './orders.seed.js';
import { seedUsers } from './users.seed.js';

/**
 * Registry of named seeders; order matters (orders need users + products,
 * engagement needs all three, loyalty accrues on shipped seed orders).
 * `npm run seed` runs all; `npm run seed -- catalog` runs a subset.
 */
export const seedRegistry: Record<string, () => Promise<string | void>> = {
  users: seedUsers,
  catalog: seedCatalog,
  orders: seedOrders,
  engagement: seedEngagement,
  loyalty: seedLoyalty,
};
