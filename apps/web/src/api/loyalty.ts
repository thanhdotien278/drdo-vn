import type { PageMeta } from '../types/catalog';
import type { LoyaltyEntry, LoyaltySummary } from '../types/loyalty';
import { apiGet } from './client';

export function fetchLoyaltySummary(): Promise<{ data: LoyaltySummary }> {
  return apiGet<LoyaltySummary>('/loyalty');
}

export async function fetchLoyaltyHistory(
  page = 1,
  limit = 10,
): Promise<{ items: LoyaltyEntry[]; meta: PageMeta }> {
  const result = await apiGet<LoyaltyEntry[]>('/loyalty/history', { page, limit });
  return { items: result.data, meta: result.meta as PageMeta };
}
