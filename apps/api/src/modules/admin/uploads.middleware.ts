import multer from 'multer';
import type { RequestHandler } from 'express';
import { ApiError } from '../../utils/apiError.js';

/**
 * Story 5.2 — product image uploads (FR-12.6-12.9). Files stay in memory
 * just long enough to be written to `/uploads/products` by the service via
 * the Wave 0 helpers (`safeUploadFileName`, `removeUploadFile`); the DB only
 * ever stores URL/path metadata.
 */

export const MAX_PRODUCT_IMAGES = 6;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_PRODUCT_IMAGES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF'));
      return;
    }
    cb(null, true);
  },
});

/** Translates multer errors into the shared `{ error, code }` contract. */
function wrapUpload(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(new ApiError(400, 'FILE_TOO_LARGE', 'Ảnh vượt quá 5MB'));
        } else if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
          next(new ApiError(400, 'INVALID_IMAGE_COUNT', 'Số lượng ảnh tải lên không hợp lệ'));
        } else {
          next(new ApiError(400, 'UPLOAD_FAILED', 'Tải ảnh lên thất bại'));
        }
        return;
      }
      next(error);
    });
  };
}

export const uploadProductImages = wrapUpload(upload.array('images', MAX_PRODUCT_IMAGES));
export const uploadProductImage = wrapUpload(upload.single('image'));
