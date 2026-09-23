import { Router } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getLoyaltySummary, listLoyaltyHistory } from './loyalty.service.js';

/**
 * Epic 8 — customer loyalty APIs. Customers read only their own derived
 * balance/tier and append-only ledger history (FR-08).
 */
export const loyaltyRouter = Router();

loyaltyRouter.use('/loyalty', requireAuth, requireRole('customer'));

loyaltyRouter.get(
  '/loyalty',
  asyncHandler(async (req, res) => {
    res.json({ data: await getLoyaltySummary(getAuthUser(req).id) });
  }),
);

loyaltyRouter.get(
  '/loyalty/history',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listLoyaltyHistory(getAuthUser(req).id, req.query);
    res.json({ data: items, meta });
  }),
);
