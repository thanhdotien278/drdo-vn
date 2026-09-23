import { Router } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createReview,
  deleteMyReview,
  getMyReview,
  listProductReviews,
  updateMyReview,
} from './review.service.js';

/**
 * Story 7.3 — review APIs. The public list exposes approved reviews only;
 * write routes are customer-role and ownership is enforced inside the
 * service (a foreign review id resolves as 404, never 403-with-leak).
 */
export const reviewRouter = Router();

reviewRouter.get(
  '/products/:productId/reviews',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listProductReviews(req.params.productId, req.query);
    res.json({ data: items, meta });
  }),
);

reviewRouter.post(
  '/products/:productId/reviews',
  requireAuth,
  requireRole('customer'),
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createReview(getAuthUser(req).id, req.params.productId, req.body) });
  }),
);

reviewRouter.get(
  '/products/:productId/reviews/me',
  requireAuth,
  requireRole('customer'),
  asyncHandler(async (req, res) => {
    res.json({ data: await getMyReview(getAuthUser(req).id, req.params.productId) });
  }),
);

reviewRouter.patch(
  '/reviews/:id',
  requireAuth,
  requireRole('customer'),
  asyncHandler(async (req, res) => {
    res.json({ data: await updateMyReview(getAuthUser(req).id, req.params.id, req.body) });
  }),
);

reviewRouter.delete(
  '/reviews/:id',
  requireAuth,
  requireRole('customer'),
  asyncHandler(async (req, res) => {
    await deleteMyReview(getAuthUser(req).id, req.params.id);
    res.json({ data: { ok: true } });
  }),
);
