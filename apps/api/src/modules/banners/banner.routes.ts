import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { uploadBannerImage } from '../admin/uploads.middleware.js';
import {
  createAdminBanner,
  deleteAdminBanner,
  listAdminBanners,
  listPublicBanners,
  updateAdminBanner,
} from './banner.service.js';

/**
 * Story 7.5 — public banner feed. No auth: the storefront home renders this
 * for anonymous visitors too (FR-07.10).
 */
export const publicBannerRouter = Router();

publicBannerRouter.get(
  '/banners',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listPublicBanners() });
  }),
);

/**
 * Story 7.5 — admin banner management. Mounted at `/api/admin` alongside
 * `adminRouter`; every mutation is audit-logged in the service.
 */
export const adminBannerRouter = Router();

adminBannerRouter.use(requireAuth, requireRole('admin'));

const actor = (req: { authUser?: { id: string; fullName: string } }) => ({
  userId: req.authUser!.id,
  role: 'admin' as const,
  label: req.authUser!.fullName,
});

adminBannerRouter.get(
  '/banners',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listAdminBanners(req.query);
    res.json({ data: items, meta });
  }),
);

adminBannerRouter.post(
  '/banners',
  uploadBannerImage,
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createAdminBanner(req.body, req.file, actor(req)) });
  }),
);

adminBannerRouter.patch(
  '/banners/:id',
  uploadBannerImage,
  asyncHandler(async (req, res) => {
    res.json({ data: await updateAdminBanner(req.params.id, req.body, req.file, actor(req)) });
  }),
);

adminBannerRouter.delete(
  '/banners/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteAdminBanner(req.params.id, actor(req)) });
  }),
);
