import { Router, type Request, type Response, type NextFunction } from 'express';
import { ApiError } from '../../utils/apiError.js';
import {
  getProductBySlug,
  listBrands,
  listCategories,
  listFeaturedProducts,
  listProducts,
  listRelatedProducts,
} from './catalog.service.js';
import { productListQuerySchema } from './product.query.js';

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export const catalogRouter = Router();

catalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listCategories() });
  }),
);

catalogRouter.get(
  '/brands',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listBrands() });
  }),
);

catalogRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const parsed = productListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw ApiError.badRequest('Tham số truy vấn không hợp lệ', parsed.error.flatten().fieldErrors);
    }

    const { items, meta } = await listProducts(parsed.data);
    res.json({ data: items, meta });
  }),
);

catalogRouter.get(
  '/products/featured',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listFeaturedProducts() });
  }),
);

catalogRouter.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    res.json({ data: await getProductBySlug(req.params.slug) });
  }),
);

catalogRouter.get(
  '/products/:slug/related',
  asyncHandler(async (req, res) => {
    res.json({ data: await listRelatedProducts(req.params.slug) });
  }),
);
