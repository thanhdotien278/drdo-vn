import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * Story 7.3 — customer product reviews (ERD `REVIEWS`). A new review always
 * starts `pending` and is publicly visible only after staff approval
 * (Story 7.4). The unique (userId, productId) index backs the
 * one-review-per-customer-per-product rule; editing an approved review
 * returns it to `pending` so changed content is moderated again.
 */
const reviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 2000 },
    status: { type: String, enum: REVIEW_STATUSES, required: true, default: 'pending', index: true },
  },
  { timestamps: true },
);

reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });

export type Review = InferSchemaType<typeof reviewSchema>;
export type ReviewDocument = HydratedDocument<Review>;
export const ReviewModel = model('Review', reviewSchema);
