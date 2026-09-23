/** Epic 7 — customer engagement wire types (wishlist, reviews, banners). */

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  availableStock: number;
  inStock: boolean;
}

export interface WishlistItem {
  id: string;
  addedAt: string;
  product: WishlistProduct;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  productId: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffReview extends Review {
  customer: { id: string; fullName: string; email: string } | null;
  product: { id: string; name: string; slug: string } | null;
}

export interface MyReviewState {
  review: Review | null;
  eligible: boolean;
}

export interface PublicBanner {
  id: string;
  imageUrl: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  linkUrl: string;
}

export interface AdminBanner extends PublicBanner {
  displayOrder: number;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}
