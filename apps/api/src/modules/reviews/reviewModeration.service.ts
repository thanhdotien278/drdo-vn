import { Types } from 'mongoose';
import { z } from 'zod';
import { REVIEW_STATUSES, ReviewModel, type ReviewStatus } from '../../models/Review.js';
import { ApiError } from '../../utils/apiError.js';
import { buildPageMeta, paginationQuerySchema, skipForPage, type PageMeta } from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { recordAudit } from '../audit/audit.service.js';
import type { StaffActor } from '../orders/orderManagement.service.js';
import { recomputeProductRating } from './review.service.js';
import { toStaffReviewDto, type StaffReviewDto } from './review.dto.js';

/**
 * Story 7.4 — shared review moderation for employees and admins. The same
 * service is mounted under `/employee/reviews` and `/admin/reviews` (like
 * `orderManagement`) so approve/reject/delete rules and their audit trail
 * cannot diverge between roles.
 */

const staffReviewListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['all', ...REVIEW_STATUSES]).default('pending'),
});

const moderationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

async function findReview(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.notFound('Không tìm thấy đánh giá');
  }
  const review = await ReviewModel.findById(id).populate('userId', 'fullName email').populate('productId', 'name slug').exec();
  if (!review) {
    throw ApiError.notFound('Không tìm thấy đánh giá');
  }
  return review;
}

/** Moderation queue — defaults to pending reviews, newest first. */
export async function listReviewsForStaff(
  query: unknown,
): Promise<{ items: StaffReviewDto[]; meta: PageMeta }> {
  const { page, limit, status } = parseInput(
    staffReviewListQuerySchema,
    query,
    'Tham số truy vấn không hợp lệ',
  );
  const filter = status === 'all' ? {} : { status };

  const [reviews, total] = await Promise.all([
    ReviewModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .populate('userId', 'fullName email')
      .populate('productId', 'name slug')
      .exec(),
    ReviewModel.countDocuments(filter).exec(),
  ]);

  return { items: reviews.map(toStaffReviewDto), meta: buildPageMeta(page, limit, total) };
}

/**
 * Approve or reject a review. Setting the current status is a safe no-op
 * (no audit noise); real transitions write `review.status_change` with the
 * previous/next moderation state and refresh the product's rating aggregate.
 */
export async function setReviewStatus(
  reviewId: string,
  input: unknown,
  actor: StaffActor,
): Promise<StaffReviewDto> {
  const data = parseInput(moderationSchema, input);
  const note = data.reason ?? data.note ?? '';
  const review = await findReview(reviewId);

  const fromStatus: ReviewStatus = review.status;
  const toStatus = data.status;
  if (fromStatus === toStatus) {
    return toStaffReviewDto(review);
  }

  review.status = toStatus;
  await review.save();

  await recordAudit({
    actor,
    action: 'review.status_change',
    entityType: 'review',
    entityId: review._id,
    previousValue: { status: fromStatus },
    nextValue: { status: toStatus },
    note,
  });

  if (fromStatus === 'approved' || toStatus === 'approved') {
    await recomputeProductRating(review.productId);
  }

  return toStaffReviewDto(review);
}

/** Staff can delete any review; the audit entry keeps a snapshot of it. */
export async function deleteReviewForStaff(
  reviewId: string,
  actor: StaffActor,
): Promise<void> {
  const review = await findReview(reviewId);
  const wasApproved = review.status === 'approved';

  await review.deleteOne();

  await recordAudit({
    actor,
    action: 'review.delete',
    entityType: 'review',
    entityId: review._id,
    previousValue: {
      status: review.status,
      rating: review.rating,
      comment: review.comment,
      userId: String(review.userId?._id ?? review.userId),
      productId: String(review.productId?._id ?? review.productId),
    },
    nextValue: null,
  });

  if (wasApproved) {
    await recomputeProductRating(review.productId);
  }
}
