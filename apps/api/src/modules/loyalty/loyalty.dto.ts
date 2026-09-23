import type { LoyaltyEntryKind, LoyaltyLedgerEntryDocument } from '../../models/LoyaltyLedgerEntry.js';
import type { MembershipTierDocument } from '../../models/MembershipTier.js';

export interface MembershipTierDto {
  id: string;
  code: string;
  name: string;
  minLifetimePoints: number;
  earnMultiplier: number;
  freeShippingThreshold: number | null;
  isActive: boolean;
  displayOrder: number;
}

export interface LoyaltySummaryDto {
  balance: number;
  lifetimeEarned: number;
  tierCode: string;
  tier: MembershipTierDto | null;
  nextTier: Pick<MembershipTierDto, 'code' | 'name' | 'minLifetimePoints'> | null;
  pointsToNextTier: number;
}

export interface LoyaltyEntryDto {
  id: string;
  kind: LoyaltyEntryKind;
  delta: number;
  balanceAfter: number;
  reason: string;
  orderNo: string | null;
  actor: { role: string | null; label: string };
  createdAt: string;
}

export function toMembershipTierDto(tier: MembershipTierDocument): MembershipTierDto {
  return {
    id: String(tier._id),
    code: tier.code,
    name: tier.name,
    minLifetimePoints: tier.minLifetimePoints,
    earnMultiplier: tier.earnMultiplier,
    freeShippingThreshold: tier.freeShippingThreshold ?? null,
    isActive: tier.isActive,
    displayOrder: tier.displayOrder,
  };
}

export function toLoyaltyEntryDto(entry: LoyaltyLedgerEntryDocument): LoyaltyEntryDto {
  return {
    id: String(entry._id),
    kind: entry.kind,
    delta: entry.delta,
    balanceAfter: entry.balanceAfter,
    reason: entry.reason ?? '',
    orderNo: entry.orderNo || null,
    actor: {
      role: entry.actor?.role ?? null,
      label: entry.actor?.label ?? '',
    },
    createdAt: entry.createdAt.toISOString(),
  };
}
