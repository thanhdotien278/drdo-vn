import { Types } from 'mongoose';
import { z } from 'zod';
import { UserModel } from '../../models/User.js';
import {
  LoyaltyLedgerEntryModel,
  type LoyaltyEntryKind,
  type LoyaltyLedgerEntryDocument,
} from '../../models/LoyaltyLedgerEntry.js';
import {
  LoyaltyAccountModel,
  type LoyaltyAccountDocument,
} from '../../models/LoyaltyAccount.js';
import {
  MembershipTierModel,
  type MembershipTierDocument,
} from '../../models/MembershipTier.js';
import type { OrderDocument } from '../../models/Order.js';
import { ApiError } from '../../utils/apiError.js';
import { buildPageMeta, paginationQuerySchema, skipForPage } from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit, type AuditActorInput } from '../audit/audit.service.js';
import {
  toLoyaltyEntryDto,
  toMembershipTierDto,
  type LoyaltyEntryDto,
  type LoyaltySummaryDto,
  type MembershipTierDto,
} from './loyalty.dto.js';
import {
  POINT_VALUE_VND,
  POINTS_REDEMPTION_CAP_RATIO,
  POINTS_REDEMPTION_STEP,
  SHIPPING_FEE_VND,
} from '../orders/orderTotals.js';

/**
 * Epic 8 — loyalty ledger and membership tiers (FR-08).
 *
 * Append-only ledger, no mutable balance counter (ADR-0011 claim-before-work
 * style): every write re-aggregates `balance = Σ delta` and stores it on the
 * row as the `balanceAfter` audit snapshot. The negative-balance check guards
 * sequential writes only — aggregate-then-insert is NOT atomic, so two truly
 * concurrent appends can both observe the pre-write balance and both insert.
 * That residual race is accepted (no DB transactions per ADR-0011); the
 * `balanceAfter` snapshots make any anomaly visible for manual correction.
 */

const SYSTEM_ACTOR: AuditActorInput = { userId: null, role: 'system', label: 'Hệ thống' };

export interface LoyaltyPointsAggregate {
  balance: number;
  lifetimeEarned: number;
}

/** balance = Σ delta; lifetimeEarned = Σ max(0, delta). */
export async function aggregatePoints(
  userId: Types.ObjectId | string,
): Promise<LoyaltyPointsAggregate> {
  const [row] = await LoyaltyLedgerEntryModel.aggregate<{
    balance: number;
    lifetimeEarned: number;
  }>([
    { $match: { userId: new Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: '$userId',
        balance: { $sum: '$delta' },
        lifetimeEarned: { $sum: { $max: [0, '$delta'] } },
      },
    },
  ]).exec();
  return { balance: row?.balance ?? 0, lifetimeEarned: row?.lifetimeEarned ?? 0 };
}

/** Read-only account lookup — used by preview paths that must not write. */
export async function getAccount(
  userId: Types.ObjectId | string,
): Promise<LoyaltyAccountDocument | null> {
  return LoyaltyAccountModel.findOne({ userId }).exec();
}

/** Current tier code lives on the account; accounts are created lazily. */
export async function getOrCreateAccount(
  userId: Types.ObjectId | string,
): Promise<LoyaltyAccountDocument> {
  const existing = await LoyaltyAccountModel.findOne({ userId }).exec();
  if (existing) {
    return existing;
  }
  try {
    return await LoyaltyAccountModel.create({ userId });
  } catch (error) {
    // Unique-index race: a concurrent request created the account first.
    if ((error as { code?: number }).code === 11000) {
      const created = await LoyaltyAccountModel.findOne({ userId }).exec();
      if (created) return created;
    }
    throw error;
  }
}

export async function getActiveTierByCode(
  tierCode: string | null | undefined,
): Promise<MembershipTierDocument | null> {
  if (!tierCode) return null;
  return MembershipTierModel.findOne({ code: tierCode, isActive: true }).exec();
}

export interface AppendEntryInput {
  userId: Types.ObjectId | string;
  kind: LoyaltyEntryKind;
  delta: number;
  reason?: string;
  actor?: AuditActorInput | null;
  orderId?: Types.ObjectId | string | null;
  orderNo?: string;
}

/**
 * Appends one ledger row. The balance is re-derived at write time and the
 * write is refused when it would push the balance negative. This is a
 * sequential-only guarantee, not serialization: concurrent appends race the
 * aggregate and can both pass — accepted under the no-transactions rule.
 */
export async function appendEntry(input: AppendEntryInput): Promise<LoyaltyLedgerEntryDocument> {
  const { balance } = await aggregatePoints(input.userId);
  const balanceAfter = balance + input.delta;
  if (balanceAfter < 0) {
    throw new ApiError(400, 'INSUFFICIENT_POINTS', 'Số dư điểm không đủ');
  }
  const actor = input.actor ?? SYSTEM_ACTOR;
  return LoyaltyLedgerEntryModel.create({
    userId: input.userId,
    kind: input.kind,
    delta: input.delta,
    balanceAfter,
    orderId: input.orderId ?? null,
    orderNo: input.orderNo ?? '',
    reason: input.reason ?? '',
    actor: {
      userId: actor.userId ?? null,
      role: actor.role ?? null,
      label: actor.label ?? '',
    },
  });
}

/**
 * FR-08 — accrual at `processing → shipped`, once per order.
 * earnBase = grandTotal - shippingFee; base = floor(earnBase/1000);
 * awarded = floor(base × multiplier of the customer's CURRENT tier).
 * A row is written even when awarded = 0 (idempotency marker), and the
 * unique partial index on orderId turns replays into silent no-ops.
 */
export async function accrueForOrder(
  order: OrderDocument,
  actor?: AuditActorInput | null,
): Promise<void> {
  const earnBase = order.totals.grandTotal - order.totals.shippingFee;
  const base = Math.floor(Math.max(0, earnBase) / 1000);

  const account = await getOrCreateAccount(order.userId);
  const tier = await getActiveTierByCode(account.tierCode);
  const multiplier = tier?.earnMultiplier ?? 1;
  const awarded = Math.floor(base * multiplier);

  try {
    await appendEntry({
      userId: order.userId,
      kind: 'accrual',
      delta: awarded,
      orderId: order._id,
      orderNo: order.orderNo,
      reason: `Tích điểm đơn hàng ${order.orderNo}`,
      actor: actor ?? SYSTEM_ACTOR,
    });
  } catch (error) {
    // Duplicate accrual for this order — exactly-once safeguard fired.
    if ((error as { code?: number }).code === 11000) {
      return;
    }
    throw error;
  }

  if (awarded > 0) {
    await recalculateTier(order.userId, account);
  }
}

/**
 * Upward-only tier recalculation after a positive ledger write. Rank is the
 * tier's POSITION in the active list sorted by `minLifetimePoints` — floors
 * can be edited non-monotonically, so comparing thresholds would not prove
 * "up". When the highest unlocked tier sits above the stored tier's
 * position, `tierCode` moves and a `tier_change` (delta=0) entry is written.
 * A stored tierCode that no longer resolves to an active tier cannot be
 * ranked and is left untouched rather than silently demoted.
 */
export async function recalculateTier(
  userId: Types.ObjectId | string,
  account?: LoyaltyAccountDocument,
): Promise<void> {
  const resolved = account ?? (await getOrCreateAccount(userId));
  const { lifetimeEarned } = await aggregatePoints(userId);
  const tiers = await MembershipTierModel.find({ isActive: true })
    .sort({ minLifetimePoints: 1 })
    .exec();
  const unlocked = tiers.filter((tier) => lifetimeEarned >= tier.minLifetimePoints);
  const target = unlocked[unlocked.length - 1];
  if (!target || target.code === resolved.tierCode) {
    return;
  }
  const currentIndex = tiers.findIndex((tier) => tier.code === resolved.tierCode);
  if (currentIndex === -1 || tiers.indexOf(target) <= currentIndex) {
    return;
  }
  const fromTier = resolved.tierCode;
  resolved.tierCode = target.code;
  await resolved.save();
  await appendEntry({
    userId,
    kind: 'tier_change',
    delta: 0,
    reason: `Nâng hạng thành viên ${fromTier} → ${target.code}`,
    actor: SYSTEM_ACTOR,
  });
}

/**
 * Redemption rules (FR-08.7): 10đ/point, multiples of 100, ≤ balance, and
 * the discount ≤ 20% of subtotal. Violations reject with 400 — never clamp.
 */
export function validateRedemption(points: number, subtotal: number, balance: number): void {
  if (!Number.isInteger(points) || points <= 0 || points % POINTS_REDEMPTION_STEP !== 0) {
    throw new ApiError(
      400,
      'INVALID_POINTS_AMOUNT',
      `Số điểm đổi phải là bội số của ${POINTS_REDEMPTION_STEP}`,
    );
  }
  const discount = points * POINT_VALUE_VND;
  if (discount > subtotal * POINTS_REDEMPTION_CAP_RATIO) {
    throw new ApiError(400, 'POINTS_CAP_EXCEEDED', 'Điểm đổi vượt quá 20% giá trị đơn hàng');
  }
  if (points > balance) {
    throw new ApiError(400, 'INSUFFICIENT_POINTS', 'Số dư điểm không đủ');
  }
}

/** Largest redeemable amount for the checkout UI (still a 100-multiple). */
export function maxRedeemablePoints(balance: number, subtotal: number): number {
  const capPoints = Math.floor((subtotal * POINTS_REDEMPTION_CAP_RATIO) / POINT_VALUE_VND);
  const raw = Math.min(balance, capPoints);
  return Math.max(0, Math.floor(raw / POINTS_REDEMPTION_STEP) * POINTS_REDEMPTION_STEP);
}

/**
 * Writes the redemption deduction for a freshly created order. Runs inside
 * checkout's compensate-on-failure block; cancelled orders never refund.
 */
export async function redeemPoints(input: {
  userId: Types.ObjectId | string;
  orderId: Types.ObjectId | string;
  orderNo: string;
  points: number;
}): Promise<LoyaltyLedgerEntryDocument> {
  return appendEntry({
    userId: input.userId,
    kind: 'redemption',
    delta: -input.points,
    orderId: input.orderId,
    orderNo: input.orderNo,
    reason: `Đổi ${input.points} điểm cho đơn ${input.orderNo}`,
    actor: { userId: input.userId, role: 'customer' },
  });
}

/**
 * Tier free-shipping: fee = 0 when the threshold is 0 (always free) or the
 * discounted subtotal (pre-redemption) reaches it; `null` = no benefit.
 */
export function shippingFeeForTier(
  tier: MembershipTierDocument | null,
  discountedSubtotal: number,
): number {
  const threshold = tier?.freeShippingThreshold;
  if (threshold === 0) return 0;
  if (threshold != null && discountedSubtotal >= threshold) return 0;
  return SHIPPING_FEE_VND;
}

// ---------- Customer-facing reads ----------

/** `GET /loyalty` — derived balance/lifetime plus current and next tier. */
export async function getLoyaltySummary(
  userId: Types.ObjectId | string,
): Promise<LoyaltySummaryDto> {
  // Read-only: never materialize an account on a GET — default to BRONZE.
  const account = await getAccount(userId);
  const tierCode = account?.tierCode ?? 'BRONZE';
  const { balance, lifetimeEarned } = await aggregatePoints(userId);
  const tiers = await MembershipTierModel.find({ isActive: true })
    .sort({ minLifetimePoints: 1 })
    .exec();

  const tier = tiers.find((candidate) => candidate.code === tierCode) ?? null;
  const nextTier = tier
    ? (tiers.find((candidate) => candidate.minLifetimePoints > tier.minLifetimePoints) ?? null)
    : (tiers.find((candidate) => candidate.minLifetimePoints > lifetimeEarned) ?? null);

  return {
    balance,
    lifetimeEarned,
    tierCode,
    tier: tier ? toMembershipTierDto(tier) : null,
    nextTier: nextTier
      ? {
          code: nextTier.code,
          name: nextTier.name,
          minLifetimePoints: nextTier.minLifetimePoints,
        }
      : null,
    pointsToNextTier: nextTier ? Math.max(0, nextTier.minLifetimePoints - lifetimeEarned) : 0,
  };
}

/** `GET /loyalty/history` — the customer's own ledger, newest first. */
export async function listLoyaltyHistory(
  userId: Types.ObjectId | string,
  query: unknown,
): Promise<{ items: LoyaltyEntryDto[]; meta: ReturnType<typeof buildPageMeta> }> {
  const { page, limit } = parseInput(paginationQuerySchema, query, 'Tham số truy vấn không hợp lệ');
  const filter = { userId };
  const [entries, total] = await Promise.all([
    LoyaltyLedgerEntryModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .exec(),
    LoyaltyLedgerEntryModel.countDocuments(filter).exec(),
  ]);
  return { items: entries.map(toLoyaltyEntryDto), meta: buildPageMeta(page, limit, total) };
}

// ---------- Admin ----------

const tierUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  minLifetimePoints: z.number().int().min(0).optional(),
  earnMultiplier: z.number().min(0).optional(),
  freeShippingThreshold: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const adjustmentSchema = z.object({
  points: z.number().int().refine((value) => value !== 0, 'Số điểm điều chỉnh phải khác 0'),
  reason: z.string().trim().min(1, 'Vui lòng nhập lý do điều chỉnh').max(500),
});

/** `GET /admin/loyalty/tiers` — every tier, lowest floor first. */
export async function listMembershipTiers(): Promise<MembershipTierDto[]> {
  const tiers = await MembershipTierModel.find()
    .sort({ minLifetimePoints: 1, displayOrder: 1 })
    .exec();
  return tiers.map(toMembershipTierDto);
}

/** `PATCH /admin/loyalty/tiers/:id` — tier config edit (admin-only). */
export async function updateMembershipTier(
  id: string,
  input: unknown,
): Promise<MembershipTierDto> {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('ID hạng thành viên không hợp lệ');
  }
  const data = parseInput(tierUpdateSchema, input);
  const tier = await MembershipTierModel.findById(id).exec();
  if (!tier) {
    throw ApiError.notFound('Không tìm thấy hạng thành viên');
  }
  if (data.name !== undefined) tier.name = data.name;
  if (data.minLifetimePoints !== undefined) tier.minLifetimePoints = data.minLifetimePoints;
  if (data.earnMultiplier !== undefined) tier.earnMultiplier = data.earnMultiplier;
  if (data.freeShippingThreshold !== undefined) {
    tier.freeShippingThreshold = data.freeShippingThreshold;
  }
  if (data.isActive !== undefined) tier.isActive = data.isActive;
  if (data.displayOrder !== undefined) tier.displayOrder = data.displayOrder;
  await tier.save();
  return toMembershipTierDto(tier);
}

async function findLoyaltyCustomer(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('ID khách hàng không hợp lệ');
  }
  const user = await UserModel.findById(id).exec();
  if (!user || !user.roles.includes('customer')) {
    throw ApiError.notFound('Không tìm thấy khách hàng');
  }
  return user;
}

/** `GET /admin/customers/:id/loyalty` — summary plus paginated ledger. */
export async function getCustomerLoyalty(
  id: string,
  query: unknown,
): Promise<{
  summary: LoyaltySummaryDto;
  items: LoyaltyEntryDto[];
  meta: ReturnType<typeof buildPageMeta>;
}> {
  const user = await findLoyaltyCustomer(id);
  const [summary, history] = await Promise.all([
    getLoyaltySummary(user._id),
    listLoyaltyHistory(user._id, query),
  ]);
  return { summary, items: history.items, meta: history.meta };
}

/**
 * `POST /admin/customers/:id/loyalty/adjustments` — manual correction path
 * (FR-08.6). `reason` is mandatory and every adjustment writes a
 * `loyalty.points_adjustment` audit record. Positive adjustments also run
 * the upward-only tier recalculation.
 */
export async function adjustCustomerPoints(
  id: string,
  input: unknown,
  actor: AuditActorInput,
): Promise<LoyaltyEntryDto> {
  const data = parseInput(adjustmentSchema, input);
  const user = await findLoyaltyCustomer(id);

  const entry = await appendEntry({
    userId: user._id,
    kind: 'adjustment',
    delta: data.points,
    reason: data.reason,
    actor,
  });

  await recordAudit({
    actor,
    action: 'loyalty.points_adjustment',
    entityType: 'loyalty',
    entityId: entry._id,
    nextValue: {
      userId: String(user._id),
      delta: entry.delta,
      balanceAfter: entry.balanceAfter,
    },
    note: data.reason,
  });

  if (data.points > 0) {
    await recalculateTier(user._id);
  }

  return toLoyaltyEntryDto(entry);
}
