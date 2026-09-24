import { Router, type Request } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createAdminCoupon,
  createAdminPromotion,
  deleteAdminCoupon,
  deleteAdminPromotion,
  listAdminCoupons,
  listAdminPromotions,
  listCouponRedemptions,
  updateAdminCoupon,
  updateAdminPromotion,
} from './promotion.service.js';

/**
 * Epic 9 — admin promotion/coupon management, mounted at `/api/admin`.
 * Admin-only (`requireRole('admin')` — employees get 403 like every other
 * admin surface); every mutation is audit-logged inside the service.
 */
export const promotionAdminRouter = Router();

promotionAdminRouter.use(requireAuth, requireRole('admin'));

const actor = (req: Request) => {
  const user = getAuthUser(req);
  return { userId: user.id, role: 'admin' as const, label: user.fullName };
};

promotionAdminRouter.get(
  '/promotions',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listAdminPromotions(req.query);
    res.json({ data: items, meta });
  }),
);

promotionAdminRouter.post(
  '/promotions',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createAdminPromotion(req.body, actor(req)) });
  }),
);

promotionAdminRouter.patch(
  '/promotions/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await updateAdminPromotion(req.params.id, req.body, actor(req)) });
  }),
);

promotionAdminRouter.delete(
  '/promotions/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteAdminPromotion(req.params.id, actor(req)) });
  }),
);

promotionAdminRouter.get(
  '/coupons',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listAdminCoupons(req.query);
    res.json({ data: items, meta });
  }),
);

promotionAdminRouter.post(
  '/coupons',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createAdminCoupon(req.body, actor(req)) });
  }),
);

promotionAdminRouter.get(
  '/coupons/:id/redemptions',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listCouponRedemptions(req.params.id, req.query);
    res.json({ data: items, meta });
  }),
);

promotionAdminRouter.patch(
  '/coupons/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await updateAdminCoupon(req.params.id, req.body, actor(req)) });
  }),
);

promotionAdminRouter.delete(
  '/coupons/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteAdminCoupon(req.params.id, actor(req)) });
  }),
);
