import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getUserById, loginWithPassword, registerCustomer } from './auth.service.js';

export const authRouter = Router();

authRouter.post(
  '/auth/register',
  asyncHandler(async (req, res) => {
    const result = await registerCustomer(req.body);
    res.status(201).json({ data: result });
  }),
);

authRouter.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    res.json({ data: await loginWithPassword(req.body) });
  }),
);

authRouter.get(
  '/auth/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.authUser ? await getUserById(req.authUser.id) : null;
    if (!user) {
      throw ApiError.unauthorized();
    }
    res.json({ data: { user } });
  }),
);

/**
 * Bearer tokens are stateless, so logout is a client-side discard. The
 * endpoint exists so clients have a stable call if a session store is added
 * later; today it only confirms the request was authenticated.
 */
authRouter.post('/auth/logout', requireAuth, (_req, res) => {
  res.json({ data: { ok: true } });
});
