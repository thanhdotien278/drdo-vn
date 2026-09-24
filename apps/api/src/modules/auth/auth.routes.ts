import { Router } from 'express';
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  changePassword,
  getUserById,
  loginWithPassword,
  registerCustomer,
  updateProfile,
} from './auth.service.js';

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

authRouter.patch(
  '/auth/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: { user: await updateProfile(getAuthUser(req).id, req.body) } });
  }),
);

authRouter.patch(
  '/auth/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    await changePassword(getAuthUser(req).id, req.body);
    res.json({ data: { ok: true } });
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
