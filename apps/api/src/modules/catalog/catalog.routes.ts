import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { parseInput } from '../../utils/validate.js';
import {
  getProductBySlug,
  listBrands,
  listCategories,
  listFeaturedProducts,
  listProducts,
  listRelatedProducts,
} from './catalog.service.js';
import { productListQuerySchema } from './product.query.js';

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
    const query = parseInput(productListQuerySchema, req.query, 'Tham số truy vấn không hợp lệ');
    const { items, meta } = await listProducts(query);
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
