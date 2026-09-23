export interface MembershipTier {
  id: string;
  code: string;
  name: string;
  minLifetimePoints: number;
  earnMultiplier: number;
  freeShippingThreshold: number | null;
  isActive: boolean;
  displayOrder: number;
}

export interface LoyaltySummary {
  balance: number;
  lifetimeEarned: number;
  tierCode: string;
  tier: MembershipTier | null;
  nextTier: Pick<MembershipTier, 'code' | 'name' | 'minLifetimePoints'> | null;
  pointsToNextTier: number;
}

export type LoyaltyEntryKind = 'accrual' | 'redemption' | 'adjustment' | 'tier_change';

export interface LoyaltyEntry {
  id: string;
  kind: LoyaltyEntryKind;
  delta: number;
  balanceAfter: number;
  reason: string;
  orderNo: string | null;
  actor: { role: string | null; label: string };
  createdAt: string;
}

export interface AdminCustomerLoyalty {
  summary: LoyaltySummary;
  items: LoyaltyEntry[];
}
