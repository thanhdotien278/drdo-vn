import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import { z } from 'zod';
import { BannerModel, type BannerDocument } from '../../models/Banner.js';
import { ApiError } from '../../utils/apiError.js';
import { buildPageMeta, paginationQuerySchema, skipForPage, type PageMeta } from '../../utils/pagination.js';
import {
  ensureUploadsDir,
  publicUploadUrl,
  removeUploadFile,
  safeUploadFileName,
} from '../../utils/uploads.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit, type AuditActorInput } from '../audit/audit.service.js';
import { toAdminBannerDto, toPublicBannerDto, type AdminBannerDto, type PublicBannerDto } from './banner.dto.js';

/**
 * Story 7.5 — storefront banner management (admin-only) and the public feed.
 * Images are stored under `/uploads/banners` through the shared Wave 0 upload
 * helpers; the DB only keeps the URL/path metadata (FR-07.11).
 */

const nullableDate = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.date().nullable(),
);

const booleanField = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

const bannerFieldsSchema = z
  .object({
    title: z.string().trim().max(200).optional().default(''),
    subtitle: z.string().trim().max(500).optional().default(''),
    imageAlt: z.string().trim().max(200).optional().default(''),
    linkUrl: z.string().trim().max(500).optional().default(''),
    displayOrder: z.coerce.number().int().min(0).max(100_000).optional().default(0),
    startAt: nullableDate.optional().default(null),
    endAt: nullableDate.optional().default(null),
    isActive: booleanField.optional().default(true),
  })
  .refine((data) => !(data.startAt && data.endAt && data.startAt > data.endAt), {
    message: 'Ngày bắt đầu phải trước ngày kết thúc',
    path: ['endAt'],
  });

const bannerUpdateSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    subtitle: z.string().trim().max(500).optional(),
    imageAlt: z.string().trim().max(200).optional(),
    linkUrl: z.string().trim().max(500).optional(),
    displayOrder: z.coerce.number().int().min(0).max(100_000).optional(),
    startAt: nullableDate.optional(),
    endAt: nullableDate.optional(),
    isActive: booleanField.optional(),
  })
  .refine(
    (data) => !(data.startAt && data.endAt && data.startAt > data.endAt),
    { message: 'Ngày bắt đầu phải trước ngày kết thúc', path: ['endAt'] },
  );

const adminBannerListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['all', 'active', 'inactive', 'deleted']).default('all'),
});

const ORDER_SORT = { displayOrder: 1, createdAt: 1, _id: 1 } as const;

/**
 * Public feed: only banners that are active, not soft-deleted, and whose
 * date window covers now. `null` bounds mean open-ended (FR-07.10).
 */
export async function listPublicBanners(): Promise<PublicBannerDto[]> {
  const now = new Date();
  const banners = await BannerModel.find({
    isActive: true,
    isDeleted: false,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
    ],
  })
    .sort(ORDER_SORT)
    .exec();
  return banners.map(toPublicBannerDto);
}

/** Admin list — soft-deleted banners are hidden unless `status=deleted`. */
export async function listAdminBanners(
  query: unknown,
): Promise<{ items: AdminBannerDto[]; meta: PageMeta }> {
  const { page, limit, status } = parseInput(
    adminBannerListQuerySchema,
    query,
    'Tham số truy vấn không hợp lệ',
  );

  const filter: Record<string, unknown> = {};
  if (status === 'deleted') {
    filter.isDeleted = true;
  } else {
    filter.isDeleted = false;
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
  }

  const [banners, total] = await Promise.all([
    BannerModel.find(filter).sort(ORDER_SORT).skip(skipForPage(page, limit)).limit(limit).exec(),
    BannerModel.countDocuments(filter).exec(),
  ]);

  return { items: banners.map(toAdminBannerDto), meta: buildPageMeta(page, limit, total) };
}

async function findBanner(id: string): Promise<BannerDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.notFound('Không tìm thấy banner');
  }
  const banner = await BannerModel.findById(id).exec();
  if (!banner) {
    throw ApiError.notFound('Không tìm thấy banner');
  }
  return banner;
}

async function persistBannerImage(file: Express.Multer.File): Promise<string> {
  const dir = await ensureUploadsDir('banners');
  const fileName = safeUploadFileName(file.originalname);
  await writeFile(path.join(dir, fileName), file.buffer);
  return publicUploadUrl('banners', fileName);
}

export async function createAdminBanner(
  input: unknown,
  file: Express.Multer.File | undefined,
  actor: AuditActorInput,
): Promise<AdminBannerDto> {
  const data = parseInput(bannerFieldsSchema, input);
  if (!file) {
    throw new ApiError(400, 'INVALID_IMAGE_COUNT', 'Vui lòng chọn ảnh banner');
  }

  const imageUrl = await persistBannerImage(file);
  const banner = await BannerModel.create({ ...data, imageUrl });

  await recordAudit({
    actor,
    action: 'banner.create',
    entityType: 'banner',
    entityId: banner._id,
    nextValue: {
      title: banner.title,
      imageUrl: banner.imageUrl,
      displayOrder: banner.displayOrder,
      isActive: banner.isActive,
    },
  });

  return toAdminBannerDto(banner);
}

const UPDATABLE_FIELDS = [
  'title',
  'subtitle',
  'imageAlt',
  'linkUrl',
  'displayOrder',
  'startAt',
  'endAt',
  'isActive',
] as const;

export async function updateAdminBanner(
  id: string,
  input: unknown,
  file: Express.Multer.File | undefined,
  actor: AuditActorInput,
): Promise<AdminBannerDto> {
  const data = parseInput(bannerUpdateSchema, input);
  const banner = await findBanner(id);
  if (banner.isDeleted) {
    throw new ApiError(409, 'BANNER_DELETED', 'Banner đã bị xóa');
  }

  const previousValue: Record<string, unknown> = {};
  const nextValue: Record<string, unknown> = {};

  for (const field of UPDATABLE_FIELDS) {
    if (data[field] === undefined) continue;
    const prev = banner[field];
    const next = data[field];
    const prevKey = prev instanceof Date ? prev.toISOString() : prev;
    const nextKey = next instanceof Date ? next.toISOString() : next;
    if (JSON.stringify(prevKey) !== JSON.stringify(nextKey)) {
      previousValue[field] = prevKey ?? null;
      nextValue[field] = nextKey ?? null;
      (banner as unknown as Record<string, unknown>)[field] = next;
    }
  }

  if (file) {
    const previousUrl = banner.imageUrl;
    banner.imageUrl = await persistBannerImage(file);
    previousValue.imageUrl = previousUrl;
    nextValue.imageUrl = banner.imageUrl;
    await removeUploadFile('banners', path.basename(previousUrl));
  }

  if (Object.keys(nextValue).length === 0) {
    return toAdminBannerDto(banner);
  }

  await banner.save();

  const prevRest = { ...previousValue };
  const nextRest = { ...nextValue };
  delete prevRest.isActive;
  delete nextRest.isActive;

  if (previousValue.isActive !== undefined) {
    await recordAudit({
      actor,
      action: 'banner.status_change',
      entityType: 'banner',
      entityId: banner._id,
      previousValue: { isActive: previousValue.isActive },
      nextValue: { isActive: nextValue.isActive },
    });
  }
  if (Object.keys(nextRest).length > 0) {
    await recordAudit({
      actor,
      action: 'banner.update',
      entityType: 'banner',
      entityId: banner._id,
      previousValue: prevRest,
      nextValue: nextRest,
    });
  }

  return toAdminBannerDto(banner);
}

export async function deleteAdminBanner(
  id: string,
  actor: AuditActorInput,
): Promise<AdminBannerDto> {
  const banner = await findBanner(id);
  if (banner.isDeleted) {
    throw new ApiError(409, 'BANNER_DELETED', 'Banner đã bị xóa');
  }

  banner.isDeleted = true;
  banner.isActive = false;
  await banner.save();

  await recordAudit({
    actor,
    action: 'banner.delete',
    entityType: 'banner',
    entityId: banner._id,
    previousValue: { isDeleted: false, title: banner.title },
    nextValue: { isDeleted: true },
  });

  return toAdminBannerDto(banner);
}
