import type { WishlistItemDocument } from '../../models/WishlistItem.js';
import { productDerived, type ProductDocument } from '../../models/Product.js';

export interface WishlistProductDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  /** Live prices resolved at read time — the wishlist stores no snapshots. */
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  availableStock: number;
  inStock: boolean;
}

export interface WishlistItemDto {
  id: string;
  addedAt: string;
  product: WishlistProductDto;
}

export function toWishlistItemDto(
  item: WishlistItemDocument,
  product: ProductDocument,
): WishlistItemDto {
  const salePrice = typeof product.salePrice === 'number' ? product.salePrice : null;
  const image = product.images.find((entry) => entry.isPrimary) ?? product.images[0];
  return {
    id: String(item._id),
    addedAt: item.addedAt.toISOString(),
    product: {
      id: String(product._id),
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      imageUrl: image?.url ?? '',
      imageAlt: image?.alt ?? product.name,
      price: product.price,
      salePrice,
      ...productDerived(product),
    },
  };
}
