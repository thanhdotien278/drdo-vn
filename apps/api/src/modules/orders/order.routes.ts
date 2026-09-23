import { Router } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { checkout, getOrderDetail, listOrders, previewOrder } from './order.service.js';

/**
 * Stories 3.4/3.5 — customer checkout and order APIs. Customers get their
 * own orders only; there is intentionally no customer-facing status or
 * payment mutation route (FR-06.9, FR-13.6).
 */
export const orderRouter = Router();

orderRouter.use('/orders', requireAuth, requireRole('customer'));

orderRouter.post(
  '/orders',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await checkout(getAuthUser(req), req.body) });
  }),
);

orderRouter.post(
  '/orders/preview',
  asyncHandler(async (req, res) => {
    res.json({ data: await previewOrder(getAuthUser(req)) });
  }),
);

orderRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listOrders(getAuthUser(req).id, req.query);
    res.json({ data: items, meta });
  }),
);

orderRouter.get(
  '/orders/:orderNo',
  asyncHandler(async (req, res) => {
    res.json({ data: await getOrderDetail(getAuthUser(req).id, req.params.orderNo) });
  }),
);
