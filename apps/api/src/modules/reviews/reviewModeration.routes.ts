import { Router, type Request } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  deleteReviewForStaff,
  listReviewsForStaff,
  setReviewStatus,
} from './reviewModeration.service.js';

/**
 * Story 7.4 — staff review moderation. Prefix-agnostic and role-parameterised
 * exactly like `createStaffOrderRouter`: mounted under `/employee` and
 * `/admin`, every mutation funnels into the shared moderation service.
 */
export function createStaffReviewRouter(role: 'employee' | 'admin'): Router {
  const router = Router();
  router.use(requireAuth, requireRole(role));

  const actor = (req: Request) => {
    const user = getAuthUser(req);
    return { userId: user.id, role, label: user.fullName };
  };

  router.get(
    '/reviews',
    asyncHandler(async (req, res) => {
      const { items, meta } = await listReviewsForStaff(req.query);
      res.json({ data: items, meta });
    }),
  );

  router.patch(
    '/reviews/:id/status',
    asyncHandler(async (req, res) => {
      res.json({ data: await setReviewStatus(req.params.id, req.body, actor(req)) });
    }),
  );

  router.delete(
    '/reviews/:id',
    asyncHandler(async (req, res) => {
      await deleteReviewForStaff(req.params.id, actor(req));
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
