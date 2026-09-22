import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

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

export const productListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  category: csv.optional(),
  brand: csv.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  availability: z.enum(['all', 'in_stock', 'out_of_stock']).default('all'),
  sort: z.enum(PRODUCT_SORTS).default('newest'),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
