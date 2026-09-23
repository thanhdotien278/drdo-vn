import type { ProductDocument } from '../../models/Product.js';
import type { ReviewDocument, ReviewStatus } from '../../models/Review.js';
import type { UserDocument } from '../../models/User.js';

/** Public/customer review shape — never leaks moderation internals. */
export interface ReviewDto {
  id: string;
  productId: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffReviewDto extends ReviewDto {
  customer: { id: string; fullName: string; email: string } | null;
  product: { id: string; name: string; slug: string } | null;
}

function authorOf(review: ReviewDocument): string {
  const user = review.userId as unknown;
  return typeof user === 'object' && user !== null && 'fullName' in user
    ? String((user as UserDocument).fullName)
    : '';
}

export function toReviewDto(review: ReviewDocument): ReviewDto {
  return {
    id: String(review._id),
    productId: String(review.productId),
    rating: review.rating,
    comment: review.comment ?? '',
    status: review.status,
    authorName: authorOf(review),
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export function toStaffReviewDto(review: ReviewDocument): StaffReviewDto {
  const user = review.userId as unknown;
  const customer =
    typeof user === 'object' && user !== null && 'fullName' in user
      ? {
          id: String((user as UserDocument)._id),
          fullName: (user as UserDocument).fullName,
          email: (user as UserDocument).email,
        }
      : null;

  const product = review.productId as unknown;
  const productInfo =
    typeof product === 'object' && product !== null && 'name' in product
      ? {
          id: String((product as ProductDocument)._id),
          name: (product as ProductDocument).name,
          slug: (product as ProductDocument).slug,
        }
      : null;

  return { ...toReviewDto(review), productId: productInfo?.id ?? String(review.productId), customer, product: productInfo };
}
