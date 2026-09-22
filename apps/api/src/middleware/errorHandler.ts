import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/apiError.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint không tồn tại' } });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  console.error('[api] unhandled error', error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi hệ thống' } });
}
