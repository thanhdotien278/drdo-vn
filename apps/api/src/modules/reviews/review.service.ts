import { Types } from 'mongoose';
import { z } from 'zod';
import { OrderItemModel } from '../../models/OrderItem.js';
import { OrderModel } from '../../models/Order.js';
import { ProductModel } from '../../models/Product.js';
import { ReviewModel, type ReviewDocument } from '../../models/Review.js';
import { ApiError } from '../../utils/apiError.js';
import { buildPageMeta, paginationQuerySchema, skipForPage, type PageMeta } from '../../utils/pagination.js';
import { parseInput } from '../../utils/validate.js';
import { toReviewDto, type ReviewDto } from './review.dto.js';

/**
 * Story 7.3 — customer review submission and ownership. Eligibility is
 * purchase-gated (a non-cancelled order containing the product); moderation
 * state changes and rating aggregation live in `reviewModeration.service.ts`
 * so staff rules stay single-sourced for both roles.
 */

const reviewBodySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
});

const reviewUpdateSchema = reviewBodySchema.partial();

/**
 * Story 7.3 — a customer may review a product only when they own a
 * non-cancelled order containing it (FR-18.3). `delivered` is not required.
 */
export async function hasPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  const orderIds = await OrderModel.find({ userId, orderStatus: { $ne: 'cancelled' } })
    .select('_id')
    .exec();
  if (orderIds.length === 0) {
    return false;
  }
  const item = await OrderItemModel.exists({
    orderId: { $in: orderIds.map((order) => order._id) },
    productId,
  }).exec();
  return item !== null;
}

function assertObjectId(id: string, message = 'Không tìm thấy đánh giá'): void {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.notFound(message);
  }
}

/**
 * Recomputes `ratingAverage`/`ratingCount` from approved reviews only
 * (FR-07.7). The product fields are derived output — never client input —
 * and are refreshed after every change to the approved set.
 */
export async function recomputeProductRating(
  product: Types.ObjectId | string | { _id: Types.ObjectId },
): Promise<void> {
  const productId = typeof product === 'object' && '_id' in product ? product._id : product;
  const [aggregate] = await ReviewModel.aggregate<{ average: number; count: number }>([
    { $match: { productId: new Types.ObjectId(String(productId)), status: 'approved' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]).exec();

  await ProductModel.updateOne(
    { _id: productId },
    {
      $set: {
        ratingAverage: aggregate ? Math.round(aggregate.average * 10) / 10 : 0,
        ratingCount: aggregate?.count ?? 0,
      },
    },
  ).exec();
}

export async function createReview(
  userId: string,
  productId: string,
  input: unknown,
): Promise<ReviewDto> {
  const data = parseInput(reviewBodySchema, input);
  assertObjectId(productId, 'Không tìm thấy sản phẩm');

  const product = await ProductModel.findById(productId).select('_id isDeleted').exec();
  if (!product || product.isDeleted) {
    throw ApiError.notFound('Không tìm thấy sản phẩm');
  }

  const eligible = await hasPurchasedProduct(userId, productId);
  if (!eligible) {
    throw new ApiError(
      403,
      'REVIEW_NOT_ELIGIBLE',
      'Chỉ khách hàng đã mua sản phẩm mới có thể đánh giá',
    );
  }

  const existing = await ReviewModel.exists({ userId, productId: product._id }).exec();
  if (existing) {
    throw new ApiError(409, 'REVIEW_EXISTS', 'Bạn đã đánh giá sản phẩm này');
  }

  try {
    const review = await ReviewModel.create({
      userId,
      productId: product._id,
      rating: data.rating,
      comment: data.comment,
      status: 'pending',
    });
    return toReviewDto(review);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new ApiError(409, 'REVIEW_EXISTS', 'Bạn đã đánh giá sản phẩm này');
    }
    throw error;
  }
}

/** Public product reviews — approved only, newest first (Story 7.4). */
export async function listProductReviews(
  productId: string,
  query: unknown,
): Promise<{ items: ReviewDto[]; meta: PageMeta }> {
  const { page, limit } = parseInput(paginationQuerySchema, query, 'Tham số truy vấn không hợp lệ');
  assertObjectId(productId, 'Không tìm thấy sản phẩm');

  const filter = { productId, status: 'approved' as const };
  const [reviews, total] = await Promise.all([
    ReviewModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skipForPage(page, limit))
      .limit(limit)
      .populate('userId', 'fullName')
      .exec(),
    ReviewModel.countDocuments(filter).exec(),
  ]);

  return { items: reviews.map(toReviewDto), meta: buildPageMeta(page, limit, total) };
}

/** The caller's own review plus purchase eligibility — drives the detail-page UI. */
export async function getMyReview(
  userId: string,
  productId: string,
): Promise<{ review: ReviewDto | null; eligible: boolean }> {
  assertObjectId(productId, 'Không tìm thấy sản phẩm');
  const [review, eligible] = await Promise.all([
    ReviewModel.findOne({ userId, productId }).exec(),
    hasPurchasedProduct(userId, productId),
  ]);
  return { review: review ? toReviewDto(review) : null, eligible };
}

async function findOwnedReview(userId: string, reviewId: string): Promise<ReviewDocument> {
  assertObjectId(reviewId);
  const review = await ReviewModel.findOne({ _id: reviewId, userId }).exec();
  if (!review) {
    throw ApiError.notFound('Không tìm thấy đánh giá');
  }
  return review;
}

/**
 * Edit own review. Any real content change resets moderation to `pending` —
 * an approved review's new text must be approved again before it is public
 * (FR-18.4). A no-change submit keeps the current status.
 */
export async function updateMyReview(
  userId: string,
  reviewId: string,
  input: unknown,
): Promise<ReviewDto> {
  const data = parseInput(reviewUpdateSchema, input);
  const review = await findOwnedReview(userId, reviewId);

  const nextRating = data.rating ?? review.rating;
  const nextComment = data.comment ?? review.comment;
  const changed = nextRating !== review.rating || nextComment !== review.comment;
  if (!changed) {
    return toReviewDto(review);
  }

  const wasApproved = review.status === 'approved';
  review.rating = nextRating;
  review.comment = nextComment;
  review.status = 'pending';
  await review.save();

  if (wasApproved) {
    await recomputeProductRating(review.productId);
  }
  return toReviewDto(review);
}

export async function deleteMyReview(userId: string, reviewId: string): Promise<void> {
  const review = await findOwnedReview(userId, reviewId);
  const wasApproved = review.status === 'approved';
  await review.deleteOne();
  if (wasApproved) {
    await recomputeProductRating(review.productId);
  }
}
