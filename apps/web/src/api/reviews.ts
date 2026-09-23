import type { PageMeta } from '../types/catalog';
import type { MyReviewState, Review, ReviewStatus, StaffReview } from '../types/engagement';
import { apiGet, apiRequest } from './client';
import type { StaffArea } from './staffOrders';

export function fetchProductReviews(
  productId: string,
  page = 1,
): Promise<{ data: Review[]; meta?: unknown }> {
  return apiGet<Review[]>(`/products/${encodeURIComponent(productId)}/reviews`, { page, limit: 5 });
}

/** The signed-in customer's own review + purchase eligibility for this product. */
export function fetchMyReview(productId: string): Promise<{ data: MyReviewState }> {
  return apiGet<MyReviewState>(`/products/${encodeURIComponent(productId)}/reviews/me`);
}

export function createReview(
  productId: string,
  body: { rating: number; comment?: string },
): Promise<{ data: Review }> {
  return apiRequest<Review>('POST', `/products/${encodeURIComponent(productId)}/reviews`, { body });
}

export function updateReview(
  reviewId: string,
  body: { rating?: number; comment?: string },
): Promise<{ data: Review }> {
  return apiRequest<Review>('PATCH', `/reviews/${encodeURIComponent(reviewId)}`, { body });
}

export function deleteReview(reviewId: string): Promise<{ data: { ok: boolean } }> {
  return apiRequest('DELETE', `/reviews/${encodeURIComponent(reviewId)}`);
}

/**
 * Story 7.4 — identical moderation endpoints under `/employee` and `/admin`;
 * the area only changes the URL prefix, same as `staffOrdersApi`.
 */
export function staffReviewsApi(area: StaffArea) {
  const base = `/${area}/reviews`;
  return {
    async fetchReviews(
      query: { status?: ReviewStatus | 'all'; page?: number } = {},
    ): Promise<{ items: StaffReview[]; meta: PageMeta }> {
      const result = await apiGet<StaffReview[]>(base, {
        status: query.status ?? 'pending',
        page: query.page,
        limit: 10,
      });
      return { items: result.data, meta: result.meta as PageMeta };
    },

    setStatus(
      reviewId: string,
      status: 'approved' | 'rejected',
      note?: string,
    ): Promise<{ data: StaffReview }> {
      return apiRequest<StaffReview>(
        'PATCH',
        `${base}/${encodeURIComponent(reviewId)}/status`,
        { body: { status, ...(note ? { note } : {}) } },
      );
    },

    remove(reviewId: string): Promise<{ data: { ok: boolean } }> {
      return apiRequest('DELETE', `${base}/${encodeURIComponent(reviewId)}`);
    },
  };
}
