import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from './address.service.js';

/** Story 3.3 — customer-owned address book (own addresses only). */
export const addressRouter = Router();

addressRouter.use('/addresses', requireAuth, requireRole('customer'));

addressRouter.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    res.json({ data: await listAddresses(req.authUser!.id) });
  }),
);

addressRouter.post(
  '/addresses',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createAddress(req.authUser!.id, req.body) });
  }),
);

addressRouter.patch(
  '/addresses/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await updateAddress(req.authUser!.id, req.params.id, req.body) });
  }),
);

addressRouter.delete(
  '/addresses/:id',
  asyncHandler(async (req, res) => {
    await deleteAddress(req.authUser!.id, req.params.id);
    res.json({ ok: true });
  }),
);

addressRouter.patch(
  '/addresses/:id/default',
  asyncHandler(async (req, res) => {
    res.json({ data: await setDefaultAddress(req.authUser!.id, req.params.id) });
  }),
);
