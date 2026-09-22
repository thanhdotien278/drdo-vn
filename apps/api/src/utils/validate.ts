import type { z, ZodTypeAny } from 'zod';
import { ApiError } from './apiError.js';

/**
 * Parses input with a zod schema; on failure throws a consistent
 * 400 ApiError carrying flattened field errors in `details`.
 */
export function parseInput<S extends ZodTypeAny>(
  schema: S,
  input: unknown,
  message = 'Dữ liệu không hợp lệ',
): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw ApiError.badRequest(message, parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}
