import type { CartItemDocument } from '../../models/CartItem.js';
import { primaryImage, productDerived, type ProductDocument } from '../../models/Product.js';

export interface CartItemProductDto {
  id: string;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string;
  imageAlt: string;
  /** Current live price — the cart line itself uses the stored snapshot. */
  effectivePrice: number;
  availableStock: number;
  inStock: boolean;
  /** False when the product was deactivated/hidden after being added. */
  purchasable: boolean;
}

export interface CartItemDto {
  id: string;
  product: CartItemProductDto | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartDto {
  id: string;
  items: CartItemDto[];
  itemCount: number;
  subtotal: number;
}

export function toCartItemDto(
  item: CartItemDocument,
  product: ProductDocument | null,
): CartItemDto {
  const unitPrice = item.unitPriceSnapshot;
  const image = product ? primaryImage(product) : undefined;
  return {
    id: String(item._id),
    qty: item.qty,
    unitPrice,
    lineTotal: unitPrice * item.qty,
    product: product
      ? {
          id: String(product._id),
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          imageUrl: image?.url ?? '',
          imageAlt: image?.alt ?? product.name,
          ...productDerived(product),
          purchasable: product.isActive && !product.isDeleted,
        }
      : null,
  };
}

export function toCartDto(cartId: string, items: CartItemDto[]): CartDto {
  return {
    id: cartId,
    items,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}
