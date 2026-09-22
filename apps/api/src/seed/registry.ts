import { seedCatalog } from './catalog.seed.js';
import { seedOrders } from './orders.seed.js';
import { seedUsers } from './users.seed.js';

/**
 * Registry of named seeders; order matters (orders need users + products).
 * Later epics register theirs here (membership tiers in Epic 8, ...).
 * `npm run seed` runs all; `npm run seed -- catalog` runs a subset.
 */
export const seedRegistry: Record<string, () => Promise<string | void>> = {
  users: seedUsers,
  catalog: seedCatalog,
  orders: seedOrders,
};
