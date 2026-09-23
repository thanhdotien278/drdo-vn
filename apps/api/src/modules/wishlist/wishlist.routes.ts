import { Router } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  addWishlistItem,
  listWishlist,
  moveWishlistItemToCart,
  removeWishlistItem,
} from './wishlist.service.js';

/**
 * Stories 7.1/7.2 — customer wishlist APIs. `requireRole('customer')` keeps
 * staff accounts out, matching the cart/address RBAC contract.
 */
export const wishlistRouter = Router();

wishlistRouter.use('/wishlist', requireAuth, requireRole('customer'));

wishlistRouter.get(
  '/wishlist',
  asyncHandler(async (req, res) => {
    res.json({ data: await listWishlist(getAuthUser(req).id) });
  }),
);

wishlistRouter.post(
  '/wishlist/items',
  asyncHandler(async (req, res) => {
    res.json({ data: await addWishlistItem(getAuthUser(req).id, req.body) });
  }),
);

wishlistRouter.delete(
  '/wishlist/items/:productId',
  asyncHandler(async (req, res) => {
    res.json({ data: await removeWishlistItem(getAuthUser(req).id, req.params.productId) });
  }),
);

wishlistRouter.post(
  '/wishlist/items/:productId/move-to-cart',
  asyncHandler(async (req, res) => {
    res.json({ data: await moveWishlistItemToCart(getAuthUser(req).id, req.params.productId) });
  }),
);
