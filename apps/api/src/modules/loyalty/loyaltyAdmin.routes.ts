import { Router, type Request } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  adjustCustomerPoints,
  getCustomerLoyalty,
  listMembershipTiers,
  updateMembershipTier,
} from './loyalty.service.js';

/**
 * Epic 8 — admin loyalty APIs, mounted under `/api/admin`. Tier config and
 * manual point adjustments are admin-only: employees get 403 from
 * `requireRole('admin')` like every other admin endpoint (FR-08.6).
 */
export const loyaltyAdminRouter = Router();

loyaltyAdminRouter.use(requireAuth, requireRole('admin'));

const actor = (req: Request) => {
  const user = getAuthUser(req);
  return { userId: user.id, role: 'admin' as const, label: user.fullName };
};

loyaltyAdminRouter.get(
  '/loyalty/tiers',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listMembershipTiers() });
  }),
);

loyaltyAdminRouter.patch(
  '/loyalty/tiers/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await updateMembershipTier(req.params.id, req.body) });
  }),
);

loyaltyAdminRouter.get(
  '/customers/:id/loyalty',
  asyncHandler(async (req, res) => {
    const { summary, items, meta } = await getCustomerLoyalty(req.params.id, req.query);
    res.json({ data: { summary, items }, meta });
  }),
);

loyaltyAdminRouter.post(
  '/customers/:id/loyalty/adjustments',
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json({ data: await adjustCustomerPoints(req.params.id, req.body, actor(req)) });
  }),
);
