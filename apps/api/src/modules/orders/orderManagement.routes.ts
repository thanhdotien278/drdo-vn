import { Router, type Request } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getOrderForStaff,
  listOrdersForStaff,
  transitionOrderStatus,
  updateOrderPaymentStatus,
} from './orderManagement.service.js';

/**
 * Stories 4.1-4.4 — staff order operations. The router is prefix-agnostic and
 * role-parameterised so Epic 5 mounts the identical handlers under
 * `/admin/orders`; every mutation funnels into the shared workflow service.
 */
export function createStaffOrderRouter(role: 'employee' | 'admin'): Router {
  const router = Router();
  router.use(requireAuth, requireRole(role));

  const actor = (req: Request) => {
    const user = getAuthUser(req);
    return { userId: user.id, role, label: user.fullName };
  };

  router.get(
    '/orders',
    asyncHandler(async (req, res) => {
      const { items, meta } = await listOrdersForStaff(req.query);
      res.json({ data: items, meta });
    }),
  );

  router.get(
    '/orders/:orderNo',
    asyncHandler(async (req, res) => {
      res.json({ data: await getOrderForStaff(req.params.orderNo) });
    }),
  );

  router.patch(
    '/orders/:orderNo/status',
    asyncHandler(async (req, res) => {
      res.json({ data: await transitionOrderStatus(req.params.orderNo, req.body, actor(req)) });
    }),
  );

  router.patch(
    '/orders/:orderNo/payment',
    asyncHandler(async (req, res) => {
      res.json({ data: await updateOrderPaymentStatus(req.params.orderNo, req.body, actor(req)) });
    }),
  );

  return router;
}
