import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { addCartItem, getCart, removeCartItem, updateCartItem } from './cart.service.js';

/**
 * Stories 3.1/3.2 — customer cart APIs. `requireRole('customer')` keeps
 * staff accounts out of customer cart state (api-spec RBAC matrix).
 */
export const cartRouter = Router();

cartRouter.use('/cart', requireAuth, requireRole('customer'));

cartRouter.get(
  '/cart',
  asyncHandler(async (req, res) => {
    res.json({ data: await getCart(req.authUser!.id) });
  }),
);

cartRouter.post(
  '/cart/items',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await addCartItem(req.authUser!.id, req.body) });
  }),
);

cartRouter.patch(
  '/cart/items/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await updateCartItem(req.authUser!.id, req.params.id, req.body) });
  }),
);

cartRouter.delete(
  '/cart/items/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await removeCartItem(req.authUser!.id, req.params.id) });
  }),
);
