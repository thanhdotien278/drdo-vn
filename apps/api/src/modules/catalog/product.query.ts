import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../utils/pagination.js';

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc', 'popular'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const csv = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.string()).max(20));

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(120).optional(),
  category: csv.optional(),
  brand: csv.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  availability: z.enum(['all', 'in_stock', 'out_of_stock']).default('all'),
  sort: z.enum(PRODUCT_SORTS).default('newest'),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
