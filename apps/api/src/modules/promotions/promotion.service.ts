import { Types } from 'mongoose';
import { z } from 'zod';
import { CouponModel, type CouponDocument } from '../../models/Coupon.js';
import { CouponRedemptionModel } from '../../models/CouponRedemption.js';
import { PromotionModel, type PromotionDocument } from '../../models/Promotion.js';
import type { ProductDocument } from '../../models/Product.js';
import { ApiError } from '../../utils/apiError.js';
import {
  buildPageMeta,
  paginationQuerySchema,
  skipForPage,
  type PageMeta,
} from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit, type AuditActorInput } from '../audit/audit.service.js';
import { COUPON_DISCOUNT_TYPES, type OrderCouponSnapshot } from '../orders/orderTotals.js';
import {
  toAdminCouponDto,
  toAdminPromotionDto,
  toCouponRedemptionDto,
  type AdminCouponDto,
  type AdminPromotionDto,
  type CouponRedemptionDto,
} from './promotion.dto.js';

/**
 * Epic 9 — promotions, coupons, and redemptions (FR-09). Admins manage both
 * resources with audited CRUD and soft delete; checkout/preview validate a
 * `couponCode` through `resolveCoupon`, which applies the rejection order and
 * error codes fixed by QA §14.5. Usage limits count `applied` redemptions
 * only — the check-then-insert is NOT atomic (accepted residual race, same
 * as the loyalty ledger; no DB transactions per ADR-0011).
 */

const nullableDate = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.date().nullable(),
);

const nullableLimit = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? null : value),
  z.coerce.number().int().min(1).nullable(),
);

const objectIdList = z
  .array(z.string().trim().refine(Types.ObjectId.isValid, 'ID không hợp lệ'))
  .max(500);

const tierCodeList = z.array(z.string().trim().min(1).max(20)).max(20);

const promotionFields = {
  name: z.string().trim().min(1, 'Vui lòng nhập tên chương trình').max(200),
  discountType: z.enum(COUPON_DISCOUNT_TYPES),
  discountValue: z.number().int().min(1),
  maxDiscountAmount: nullableLimit,
  startAt: nullableDate,
  endAt: nullableDate,
  minOrderTotal: z.number().int().min(0),
  productIds: objectIdList,
  categoryIds: objectIdList,
  brandIds: objectIdList,
  tierCodes: tierCodeList,
  isActive: z.boolean(),
};

const promotionCreateSchema = z
  .object({
    name: promotionFields.name,
    discountType: promotionFields.discountType,
    discountValue: promotionFields.discountValue,
    maxDiscountAmount: promotionFields.maxDiscountAmount.optional().default(null),
    startAt: promotionFields.startAt.optional().default(null),
    endAt: promotionFields.endAt.optional().default(null),
    minOrderTotal: promotionFields.minOrderTotal.optional().default(0),
    productIds: promotionFields.productIds.optional().default([]),
    categoryIds: promotionFields.categoryIds.optional().default([]),
    brandIds: promotionFields.brandIds.optional().default([]),
    tierCodes: promotionFields.tierCodes.optional().default([]),
    isActive: promotionFields.isActive.optional().default(true),
  })
  .refine((data) => !(data.startAt && data.endAt && data.startAt > data.endAt), {
    message: 'Ngày bắt đầu phải trước ngày kết thúc',
    path: ['endAt'],
  })
  .refine((data) => data.discountType !== 'percentage' || data.discountValue <= 100, {
    message: 'Giá trị phần trăm không được vượt quá 100',
    path: ['discountValue'],
  });

const promotionUpdateSchema = z
  .object({
    name: promotionFields.name.optional(),
    discountType: promotionFields.discountType.optional(),
    discountValue: promotionFields.discountValue.optional(),
    maxDiscountAmount: promotionFields.maxDiscountAmount.optional(),
    startAt: promotionFields.startAt.optional(),
    endAt: promotionFields.endAt.optional(),
    minOrderTotal: promotionFields.minOrderTotal.optional(),
    productIds: promotionFields.productIds.optional(),
    categoryIds: promotionFields.categoryIds.optional(),
    brandIds: promotionFields.brandIds.optional(),
    tierCodes: promotionFields.tierCodes.optional(),
    isActive: promotionFields.isActive.optional(),
  })
  .refine((data) => !(data.startAt && data.endAt && data.startAt > data.endAt), {
    message: 'Ngày bắt đầu phải trước ngày kết thúc',
    path: ['endAt'],
  })
  .refine(
    (data) =>
      data.discountType !== 'percentage' ||
      data.discountValue === undefined ||
      data.discountValue <= 100,
    { message: 'Giá trị phần trăm không được vượt quá 100', path: ['discountValue'] },
  );

const couponFields = {
  code: z.string().trim().min(1, 'Vui lòng nhập mã').max(50),
  promotionId: z.string().trim().refine(Types.ObjectId.isValid, 'ID chương trình không hợp lệ'),
  usageLimitTotal: nullableLimit,
  usageLimitPerCustomer: nullableLimit,
  isActive: z.boolean(),
};

const couponCreateSchema = z.object({
  code: couponFields.code,
  promotionId: couponFields.promotionId,
  usageLimitTotal: couponFields.usageLimitTotal.optional().default(null),
  usageLimitPerCustomer: couponFields.usageLimitPerCustomer.optional().default(null),
  isActive: couponFields.isActive.optional().default(true),
});

const couponUpdateSchema = z.object({
  code: couponFields.code.optional(),
  promotionId: couponFields.promotionId.optional(),
  usageLimitTotal: couponFields.usageLimitTotal.optional(),
  usageLimitPerCustomer: couponFields.usageLimitPerCustomer.optional(),
  isActive: couponFields.isActive.optional(),
});

const adminListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['all', 'active', 'inactive', 'deleted']).default('all'),
});

const adminCouponListQuerySchema = adminListQuerySchema.extend({
  promotionId: z
    .string()
    .trim()
    .refine(Types.ObjectId.isValid, 'ID chương trình không hợp lệ')
    .optional(),
});

function statusFilter(status: 'all' | 'active' | 'inactive' | 'deleted'): Record<string, unknown> {
  if (status === 'deleted') return { isDeleted: true };
  const filter: Record<string, unknown> = { isDeleted: false };
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;
  return filter;
}

const normalizeTierCodes = (codes: string[]): string[] =>
  codes.map((code) => code.toUpperCase());

/**
 * Order-insensitive audit-diff key: dates → ISO strings, arrays → sorted
 * string copies, so a resubmitted array in a different order does not
 * produce a phantom `update` audit entry.
 */
function auditKey(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(String).sort();
  return value ?? null;
}

// ---------- Promotions (admin CRUD) ----------

export async function listAdminPromotions(
  query: unknown,
): Promise<{ items: AdminPromotionDto[]; meta: PageMeta }> {
  const { page, limit, status } = parseInput(
    adminListQuerySchema,
    query,
    'Tham số truy vấn không hợp lệ',
  );
  const filter = statusFilter(status);
  const [promotions, total] = await Promise.all([
    PromotionModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .exec(),
    PromotionModel.countDocuments(filter).exec(),
  ]);
  return {
    items: promotions.map(toAdminPromotionDto),
    meta: buildPageMeta(page, limit, total),
  };
}

export async function createAdminPromotion(
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminPromotionDto> {
  const data = parseInput(promotionCreateSchema, input);
  const promotion = await PromotionModel.create({
    ...data,
    tierCodes: normalizeTierCodes(data.tierCodes),
  });

  await recordAudit({
    actor,
    action: 'promotion.create',
    entityType: 'promotion',
    entityId: promotion._id,
    nextValue: {
      name: promotion.name,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      isActive: promotion.isActive,
    },
  });

  return toAdminPromotionDto(promotion);
}

async function findPromotion(id: string): Promise<PromotionDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.notFound('Không tìm thấy chương trình khuyến mãi');
  }
  const promotion = await PromotionModel.findById(id).exec();
  if (!promotion) {
    throw ApiError.notFound('Không tìm thấy chương trình khuyến mãi');
  }
  return promotion;
}

const PROMOTION_UPDATABLE_FIELDS = [
  'name',
  'discountType',
  'discountValue',
  'maxDiscountAmount',
  'startAt',
  'endAt',
  'minOrderTotal',
  'productIds',
  'categoryIds',
  'brandIds',
  'tierCodes',
  'isActive',
] as const;

export async function updateAdminPromotion(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminPromotionDto> {
  const data = parseInput(promotionUpdateSchema, input);
  const promotion = await findPromotion(id);
  if (promotion.isDeleted) {
    throw new ApiError(409, 'PROMOTION_DELETED', 'Chương trình khuyến mãi đã bị xóa');
  }

  const previousValue: Record<string, unknown> = {};
  const nextValue: Record<string, unknown> = {};

  for (const field of PROMOTION_UPDATABLE_FIELDS) {
    let next = data[field];
    if (next === undefined) continue;
    if (field === 'tierCodes') next = normalizeTierCodes(next as string[]);
    const prevKey = auditKey(promotion[field]);
    const nextKey = auditKey(next);
    if (JSON.stringify(prevKey) !== JSON.stringify(nextKey)) {
      previousValue[field] = prevKey;
      nextValue[field] = nextKey;
      (promotion as unknown as Record<string, unknown>)[field] = next;
    }
  }

  if (Object.keys(nextValue).length === 0) {
    return toAdminPromotionDto(promotion);
  }

  // Guard the window even when only one bound is sent in the patch.
  if (
    promotion.startAt &&
    promotion.endAt &&
    promotion.startAt > promotion.endAt
  ) {
    throw ApiError.badRequest('Ngày bắt đầu phải trước ngày kết thúc');
  }
  if (promotion.discountType === 'percentage' && promotion.discountValue > 100) {
    throw ApiError.badRequest('Giá trị phần trăm không được vượt quá 100');
  }

  await promotion.save();

  const prevRest = { ...previousValue };
  const nextRest = { ...nextValue };
  delete prevRest.isActive;
  delete nextRest.isActive;

  if (previousValue.isActive !== undefined) {
    await recordAudit({
      actor,
      action: 'promotion.status_change',
      entityType: 'promotion',
      entityId: promotion._id,
      previousValue: { isActive: previousValue.isActive },
      nextValue: { isActive: nextValue.isActive },
    });
  }
  if (Object.keys(nextRest).length > 0) {
    await recordAudit({
      actor,
      action: 'promotion.update',
      entityType: 'promotion',
      entityId: promotion._id,
      previousValue: prevRest,
      nextValue: nextRest,
    });
  }

  return toAdminPromotionDto(promotion);
}

export async function deleteAdminPromotion(
  id: string,
  actor: AuditActorInput,
): Promise<AdminPromotionDto> {
  const promotion = await findPromotion(id);
  if (promotion.isDeleted) {
    throw new ApiError(409, 'PROMOTION_DELETED', 'Chương trình khuyến mãi đã bị xóa');
  }

  promotion.isDeleted = true;
  promotion.isActive = false;
  await promotion.save();

  await recordAudit({
    actor,
    action: 'promotion.delete',
    entityType: 'promotion',
    entityId: promotion._id,
    previousValue: { isDeleted: false, name: promotion.name },
    nextValue: { isDeleted: true },
  });

  return toAdminPromotionDto(promotion);
}

// ---------- Coupons (admin CRUD + usage) ----------

async function appliedCountByCoupon(
  couponIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  const rows = await CouponRedemptionModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { couponId: { $in: couponIds }, status: 'applied' } },
    { $group: { _id: '$couponId', count: { $sum: 1 } } },
  ]).exec();
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function listAdminCoupons(
  query: unknown,
): Promise<{ items: AdminCouponDto[]; meta: PageMeta }> {
  const { page, limit, status, promotionId } = parseInput(
    adminCouponListQuerySchema,
    query,
    'Tham số truy vấn không hợp lệ',
  );
  const filter: Record<string, unknown> = statusFilter(status);
  if (promotionId) filter.promotionId = promotionId;

  const [coupons, total] = await Promise.all([
    CouponModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .exec(),
    CouponModel.countDocuments(filter).exec(),
  ]);

  const [counts, promotions] = await Promise.all([
    appliedCountByCoupon(coupons.map((coupon) => coupon._id)),
    PromotionModel.find({ _id: { $in: coupons.map((coupon) => coupon.promotionId) } }).exec(),
  ]);
  const nameByPromotion = new Map(promotions.map((promo) => [String(promo._id), promo.name]));

  return {
    items: coupons.map((coupon) =>
      toAdminCouponDto(
        coupon,
        counts.get(String(coupon._id)) ?? 0,
        nameByPromotion.get(String(coupon.promotionId)) ?? '',
      ),
    ),
    meta: buildPageMeta(page, limit, total),
  };
}

async function findCoupon(id: string): Promise<CouponDocument> {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.notFound('Không tìm thấy mã giảm giá');
  }
  const coupon = await CouponModel.findById(id).exec();
  if (!coupon) {
    throw ApiError.notFound('Không tìm thấy mã giảm giá');
  }
  return coupon;
}

async function assertPromotionUsable(promotionId: string): Promise<void> {
  const promotion = await PromotionModel.findById(promotionId).exec();
  if (!promotion || promotion.isDeleted) {
    throw new ApiError(400, 'INVALID_PROMOTION', 'Chương trình khuyến mãi không tồn tại');
  }
}

async function assertCodeAvailable(code: string, excludeId?: Types.ObjectId): Promise<void> {
  const taken = await CouponModel.exists({
    code,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).exec();
  if (taken) {
    throw new ApiError(409, 'COUPON_CODE_TAKEN', 'Mã giảm giá đã được sử dụng');
  }
}

async function usageCountFor(couponId: Types.ObjectId): Promise<number> {
  return CouponRedemptionModel.countDocuments({ couponId, status: 'applied' }).exec();
}

export async function createAdminCoupon(
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminCouponDto> {
  const data = parseInput(couponCreateSchema, input);
  const code = data.code.toUpperCase();
  await assertPromotionUsable(data.promotionId);
  await assertCodeAvailable(code);

  let coupon: CouponDocument;
  try {
    coupon = await CouponModel.create({ ...data, code });
  } catch (error) {
    // Unique-index race — same outcome as the pre-check.
    if ((error as { code?: number }).code === 11000) {
      throw new ApiError(409, 'COUPON_CODE_TAKEN', 'Mã giảm giá đã được sử dụng');
    }
    throw error;
  }

  await recordAudit({
    actor,
    action: 'coupon.create',
    entityType: 'coupon',
    entityId: coupon._id,
    nextValue: {
      code: coupon.code,
      promotionId: String(coupon.promotionId),
      isActive: coupon.isActive,
    },
  });

  return toAdminCouponDto(coupon, await usageCountFor(coupon._id));
}

const COUPON_UPDATABLE_FIELDS = [
  'promotionId',
  'usageLimitTotal',
  'usageLimitPerCustomer',
  'isActive',
] as const;

export async function updateAdminCoupon(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<AdminCouponDto> {
  const data = parseInput(couponUpdateSchema, input);
  const coupon = await findCoupon(id);
  if (coupon.isDeleted) {
    throw new ApiError(409, 'COUPON_DELETED', 'Mã giảm giá đã bị xóa');
  }

  const previousValue: Record<string, unknown> = {};
  const nextValue: Record<string, unknown> = {};

  if (data.code !== undefined) {
    const code = data.code.toUpperCase();
    if (code !== coupon.code) {
      await assertCodeAvailable(code, coupon._id);
      previousValue.code = coupon.code;
      nextValue.code = code;
      coupon.code = code;
    }
  }

  for (const field of COUPON_UPDATABLE_FIELDS) {
    let next: unknown = data[field];
    if (next === undefined) continue;
    if (field === 'promotionId') {
      await assertPromotionUsable(next as string);
      next = new Types.ObjectId(next as string);
    }
    const prevKey = auditKey(coupon[field]);
    const nextKey = auditKey(next);
    if (JSON.stringify(prevKey) !== JSON.stringify(nextKey)) {
      previousValue[field] = prevKey;
      nextValue[field] = nextKey;
      (coupon as unknown as Record<string, unknown>)[field] = next;
    }
  }

  if (Object.keys(nextValue).length === 0) {
    return toAdminCouponDto(coupon, await usageCountFor(coupon._id));
  }

  try {
    await coupon.save();
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new ApiError(409, 'COUPON_CODE_TAKEN', 'Mã giảm giá đã được sử dụng');
    }
    throw error;
  }

  const prevRest = { ...previousValue };
  const nextRest = { ...nextValue };
  delete prevRest.isActive;
  delete nextRest.isActive;

  if (previousValue.isActive !== undefined) {
    await recordAudit({
      actor,
      action: 'coupon.status_change',
      entityType: 'coupon',
      entityId: coupon._id,
      previousValue: { isActive: previousValue.isActive },
      nextValue: { isActive: nextValue.isActive },
    });
  }
  if (Object.keys(nextRest).length > 0) {
    await recordAudit({
      actor,
      action: 'coupon.update',
      entityType: 'coupon',
      entityId: coupon._id,
      previousValue: prevRest,
      nextValue: nextRest,
    });
  }

  return toAdminCouponDto(coupon, await usageCountFor(coupon._id));
}

export async function deleteAdminCoupon(
  id: string,
  actor: AuditActorInput,
): Promise<AdminCouponDto> {
  const coupon = await findCoupon(id);
  if (coupon.isDeleted) {
    throw new ApiError(409, 'COUPON_DELETED', 'Mã giảm giá đã bị xóa');
  }

  // Release the code (taxonomy pattern) so a replacement coupon can reuse it;
  // historical orders keep resolving through couponRef.couponId.
  const previousCode = coupon.code;
  coupon.code = `${coupon.code}--del-${Date.now()}`;
  coupon.isDeleted = true;
  coupon.isActive = false;
  await coupon.save();

  await recordAudit({
    actor,
    action: 'coupon.delete',
    entityType: 'coupon',
    entityId: coupon._id,
    previousValue: { isDeleted: false, code: previousCode },
    nextValue: { isDeleted: true },
  });

  return toAdminCouponDto(coupon, await usageCountFor(coupon._id));
}

/** Per-coupon redemption history for the admin usage view. */
export async function listCouponRedemptions(
  couponId: string,
  query: unknown,
): Promise<{ items: CouponRedemptionDto[]; meta: PageMeta }> {
  const coupon = await findCoupon(couponId);
  const { page, limit } = parseInput(paginationQuerySchema, query, 'Tham số truy vấn không hợp lệ');
  const filter = { couponId: coupon._id };
  const [redemptions, total] = await Promise.all([
    CouponRedemptionModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .exec(),
    CouponRedemptionModel.countDocuments(filter).exec(),
  ]);
  return {
    items: redemptions.map(toCouponRedemptionDto),
    meta: buildPageMeta(page, limit, total),
  };
}

// ---------- Customer-facing resolution ----------

/** VND removed by a promotion on the given base, honouring the cap and base. */
export function computeDiscount(
  promotion: Pick<PromotionDocument, 'discountType' | 'discountValue' | 'maxDiscountAmount'>,
  base: number,
): number {
  const raw =
    promotion.discountType === 'percentage'
      ? Math.floor((base * promotion.discountValue) / 100)
      : promotion.discountValue;
  const capped =
    promotion.maxDiscountAmount != null ? Math.min(raw, promotion.maxDiscountAmount) : raw;
  return Math.max(0, Math.min(capped, base));
}

export interface ResolveCouponInput {
  code: string;
  userId: Types.ObjectId | string;
  /** Cart/order lines with server-side line totals. */
  lines: ReadonlyArray<{ productId: Types.ObjectId; lineTotal: number }>;
  /** Products behind the lines, for category/brand scope matching. */
  products: ReadonlyMap<string, Pick<ProductDocument, 'category' | 'brand'>>;
  /** Customer's current tier code; null/undefined means no tier. */
  tierCode?: string | null;
}

export interface ResolvedCoupon {
  coupon: CouponDocument;
  promotion: PromotionDocument;
  /** VND discount to pass into `computeOrderTotals` as `discountAmount`. */
  discountAmount: number;
  snapshot: OrderCouponSnapshot;
}

/**
 * The single validation entry shared by `checkout` and `previewOrder` — the
 * preview must agree with the resulting order (QA §14.6). Rejection order and
 * codes are fixed by QA §14.5, all `400`:
 * NOT_FOUND → INACTIVE → NOT_STARTED → EXPIRED → TIER_INELIGIBLE →
 * MIN_ORDER_NOT_MET → NOT_APPLICABLE → USAGE_LIMIT → CUSTOMER_LIMIT.
 */
export async function resolveCoupon(input: ResolveCouponInput): Promise<ResolvedCoupon> {
  const code = input.code.trim().toUpperCase();

  // Soft-deleted coupons carry a `--del-<ts>` suffix, so they never match —
  // indistinguishable from unknown codes by design. The `isDeleted` check is
  // defensive cover for rows deleted without the suffix (manual DB edits).
  const coupon = await CouponModel.findOne({ code }).exec();
  if (!coupon || coupon.isDeleted) {
    throw new ApiError(400, 'COUPON_NOT_FOUND', 'Mã giảm giá không tồn tại');
  }

  const promotion = await PromotionModel.findById(coupon.promotionId).exec();
  if (!coupon.isActive || !promotion || promotion.isDeleted || !promotion.isActive) {
    // A disabled/deleted promotion is indistinguishable from a dead coupon.
    throw new ApiError(400, 'COUPON_INACTIVE', 'Mã giảm giá không còn hiệu lực');
  }

  const now = new Date();
  if (promotion.startAt && promotion.startAt > now) {
    throw new ApiError(400, 'COUPON_NOT_STARTED', 'Mã giảm giá chưa bắt đầu áp dụng');
  }
  if (promotion.endAt && promotion.endAt < now) {
    throw new ApiError(400, 'COUPON_EXPIRED', 'Mã giảm giá đã hết hạn');
  }

  const tierCodes = promotion.tierCodes ?? [];
  const tierCode = input.tierCode?.toUpperCase() ?? null;
  if (tierCodes.length > 0 && (!tierCode || !tierCodes.includes(tierCode))) {
    throw new ApiError(400, 'COUPON_TIER_INELIGIBLE', 'Mã giảm giá không áp dụng cho hạng của bạn');
  }

  const subtotal = input.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  if (subtotal < promotion.minOrderTotal) {
    throw new ApiError(400, 'COUPON_MIN_ORDER_NOT_MET', 'Đơn hàng chưa đạt giá trị tối thiểu', {
      minOrderTotal: promotion.minOrderTotal,
    });
  }

  const base = scopeBase(promotion, input.lines, input.products, subtotal);
  if (base <= 0) {
    throw new ApiError(400, 'COUPON_NOT_APPLICABLE', 'Mã giảm giá không áp dụng cho giỏ hàng này');
  }

  // Usage limits count `applied` rows only. Check-then-insert is not atomic —
  // the same accepted residual race as the loyalty ledger (ADR-0011).
  if (coupon.usageLimitTotal != null) {
    const used = await usageCountFor(coupon._id);
    if (used >= coupon.usageLimitTotal) {
      throw new ApiError(400, 'COUPON_USAGE_LIMIT_REACHED', 'Mã giảm giá đã hết lượt sử dụng');
    }
  }
  if (coupon.usageLimitPerCustomer != null) {
    const used = await CouponRedemptionModel.countDocuments({
      couponId: coupon._id,
      userId: input.userId,
      status: 'applied',
    }).exec();
    if (used >= coupon.usageLimitPerCustomer) {
      throw new ApiError(400, 'COUPON_CUSTOMER_LIMIT_REACHED', 'Bạn đã dùng hết lượt của mã này');
    }
  }

  const discountAmount = computeDiscount(promotion, base);
  return {
    coupon,
    promotion,
    discountAmount,
    snapshot: {
      couponId: coupon._id,
      promotionId: promotion._id,
      code: coupon.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      maxDiscountAmount: promotion.maxDiscountAmount ?? null,
    },
  };
}

/**
 * The discount base: with any scope array set, only lines whose product ∈
 * `productIds` OR whose `category`/`brand` ∈ the scope arrays count; with all
 * three empty the base is the whole subtotal (QA §14.5 "scope is the base").
 */
function scopeBase(
  promotion: PromotionDocument,
  lines: ResolveCouponInput['lines'],
  products: ResolveCouponInput['products'],
  subtotal: number,
): number {
  const productIds = new Set((promotion.productIds ?? []).map((id) => String(id)));
  const categoryIds = new Set((promotion.categoryIds ?? []).map((id) => String(id)));
  const brandIds = new Set((promotion.brandIds ?? []).map((id) => String(id)));
  if (productIds.size === 0 && categoryIds.size === 0 && brandIds.size === 0) {
    return subtotal;
  }
  let base = 0;
  for (const line of lines) {
    const product = products.get(String(line.productId));
    if (!product) continue;
    const inScope =
      productIds.has(String(line.productId)) ||
      categoryIds.has(String(product.category)) ||
      brandIds.has(String(product.brand));
    if (inScope) {
      base += line.lineTotal;
    }
  }
  return base;
}

/**
 * Pre-shipment cancellation release (QA §14.5): a claim-before-work update
 * flips the one `applied` redemption to `released`, freeing the usage limits.
 * Orders without a coupon — or an already-released replay — are no-ops.
 */
export async function releaseCouponRedemption(
  orderId: Types.ObjectId | string,
): Promise<void> {
  await CouponRedemptionModel.updateOne(
    { orderId, status: 'applied' },
    { $set: { status: 'released', releasedAt: new Date() } },
  ).exec();
}
