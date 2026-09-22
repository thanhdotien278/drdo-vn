import type {
  Availability,
  Brand,
  Category,
  FeaturedProducts,
  PageMeta,
  ProductDetail,
  ProductListItem,
  ProductSort,
} from '../types/catalog';
import { apiGet } from './client';

export type ProductListParams = {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: Availability;
  sort?: ProductSort;
}

export function fetchCategories(): Promise<{ data: Category[] }> {
  return apiGet<Category[]>('/categories');
}

export function fetchBrands(): Promise<{ data: Brand[] }> {
  return apiGet<Brand[]>('/brands');
}

export async function fetchProducts(
  params: ProductListParams,
): Promise<{ items: ProductListItem[]; meta: PageMeta }> {
  const result = await apiGet<ProductListItem[]>('/products', params);
  return { items: result.data, meta: result.meta as PageMeta };
}

export function fetchFeaturedProducts(): Promise<{ data: FeaturedProducts }> {
  return apiGet<FeaturedProducts>('/products/featured');
}

export function fetchProductBySlug(slug: string): Promise<{ data: ProductDetail }> {
  return apiGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
}

export function fetchRelatedProducts(slug: string): Promise<{ data: ProductListItem[] }> {
  return apiGet<ProductListItem[]>(`/products/${encodeURIComponent(slug)}/related`);
}
