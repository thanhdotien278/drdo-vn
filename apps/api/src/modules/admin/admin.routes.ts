import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listAdminAuditLogs } from './auditLogs.service.js';
import {
  getAdminCustomer,
  listAdminCustomers,
  setAdminCustomerStatus,
} from './customers.service.js';
import { getAdminDashboard } from './dashboard.service.js';
import {
  addProductImages,
  createAdminProduct,
  deleteAdminProduct,
  deleteProductImage,
  getAdminProduct,
  listAdminProducts,
  replaceProductImage,
  updateAdminProduct,
} from './products.service.js';
import {
  createAdminStaff,
  listAdminStaff,
  setAdminStaffRole,
  setAdminStaffStatus,
} from './staff.service.js';
import {
  createAdminBrand,
  createAdminCategory,
  deleteAdminBrand,
  deleteAdminCategory,
  listAdminBrands,
  listAdminCategories,
  updateAdminBrand,
  updateAdminCategory,
} from './taxonomy.service.js';
import { uploadProductImage, uploadProductImages } from './uploads.middleware.js';

/**
 * Epic 5 — admin operations. `/admin/orders` is mounted separately in
 * `app.ts` through the shared Epic 4 `createStaffOrderRouter('admin')`, so
 * order transitions and manual payment rules cannot diverge between roles.
 */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

const actor = (req: { authUser?: { id: string; fullName: string } }) => ({
  userId: req.authUser!.id,
  role: 'admin' as const,
  label: req.authUser!.fullName,
});

// ---------- Story 5.1: dashboard ----------

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    res.json({ data: await getAdminDashboard() });
  }),
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listAdminAuditLogs(req.query);
    res.json({ data: items, meta });
  }),
);

// ---------- Story 5.2: products + images ----------

adminRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listAdminProducts(req.query);
    res.json({ data: items, meta });
  }),
);

adminRouter.post(
  '/products',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createAdminProduct(req.body, actor(req)) });
  }),
);

adminRouter.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await getAdminProduct(req.params.id) });
  }),
);

adminRouter.patch(
  '/products/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await updateAdminProduct(req.params.id, req.body, actor(req)) });
  }),
);

adminRouter.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteAdminProduct(req.params.id, actor(req)) });
  }),
);

adminRouter.post(
  '/products/:id/images',
  uploadProductImages,
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    const alt = typeof req.body?.alt === 'string' ? req.body.alt : undefined;
    res.json({ data: await addProductImages(req.params.id, files, alt, actor(req)) });
  }),
);

adminRouter.patch(
  '/products/:id/images/:imageId',
  uploadProductImage,
  asyncHandler(async (req, res) => {
    res.json({
      data: await replaceProductImage(
        req.params.id,
        req.params.imageId,
        req.file,
        actor(req),
      ),
    });
  }),
);

adminRouter.delete(
  '/products/:id/images/:imageId',
  asyncHandler(async (req, res) => {
    res.json({
      data: await deleteProductImage(req.params.id, req.params.imageId, actor(req)),
    });
  }),
);

// ---------- Story 5.3: categories + brands ----------

adminRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listAdminCategories() });
  }),
);

adminRouter.post(
  '/categories',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createAdminCategory(req.body, actor(req)) });
  }),
);

adminRouter.patch(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await updateAdminCategory(req.params.id, req.body, actor(req)) });
  }),
);

adminRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteAdminCategory(req.params.id, actor(req)) });
  }),
);

adminRouter.get(
  '/brands',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listAdminBrands() });
  }),
);

adminRouter.post(
  '/brands',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createAdminBrand(req.body, actor(req)) });
  }),
);

adminRouter.patch(
  '/brands/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await updateAdminBrand(req.params.id, req.body, actor(req)) });
  }),
);

adminRouter.delete(
  '/brands/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await deleteAdminBrand(req.params.id, actor(req)) });
  }),
);

// ---------- Story 5.4: customers ----------

adminRouter.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listAdminCustomers(req.query);
    res.json({ data: items, meta });
  }),
);

adminRouter.get(
  '/customers/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await getAdminCustomer(req.params.id) });
  }),
);

adminRouter.patch(
  '/customers/:id/status',
  asyncHandler(async (req, res) => {
    res.json({ data: await setAdminCustomerStatus(req.params.id, req.body, actor(req)) });
  }),
);

// ---------- Story 5.5: staff ----------

adminRouter.get(
  '/staff',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listAdminStaff() });
  }),
);

adminRouter.post(
  '/staff',
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await createAdminStaff(req.body, actor(req)) });
  }),
);

adminRouter.patch(
  '/staff/:id/role',
  asyncHandler(async (req, res) => {
    res.json({ data: await setAdminStaffRole(req.params.id, req.body, actor(req)) });
  }),
);

adminRouter.patch(
  '/staff/:id/status',
  asyncHandler(async (req, res) => {
    res.json({ data: await setAdminStaffStatus(req.params.id, req.body, actor(req)) });
  }),
);
