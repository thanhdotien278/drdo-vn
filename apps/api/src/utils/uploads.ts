import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { slugify } from './slug.js';

export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

/**
 * Upload areas served under `/uploads/<area>`. Extend as later epics
 * (banners in 7.5, etc.) need storage.
 */
export const UPLOAD_AREAS = ['products', 'banners'] as const;
export type UploadArea = (typeof UPLOAD_AREAS)[number];

export function uploadsDir(area: UploadArea): string {
  return path.join(UPLOADS_ROOT, area);
}

export function publicUploadUrl(area: UploadArea, fileName: string): string {
  return `/uploads/${area}/${fileName}`;
}

export async function ensureUploadsDir(area: UploadArea): Promise<string> {
  const dir = uploadsDir(area);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Collision-safe stored file name: timestamp + random suffix + slugged base.
 */
export function safeUploadFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base = slugify(path.basename(originalName, ext)) || 'image';
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${base}${ext}`;
}

/**
 * Removes a stored file. `fileName` is basename-normalized so callers can
 * pass either a stored name or a public URL path segment without escaping
 * the upload area directory.
 */
export async function removeUploadFile(area: UploadArea, fileName: string): Promise<void> {
  const filePath = path.join(uploadsDir(area), path.basename(fileName));
  await unlink(filePath).catch(() => undefined);
}
