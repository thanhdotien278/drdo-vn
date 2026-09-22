export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  country: string;
}

export interface ProductImage {
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  discountPercent: number;
  images: ProductImage[];
  category: Category | null;
  brand: Brand | null;
  availableStock: number;
  inStock: boolean;
  ratingAverage: number;
  ratingCount: number;
  volume: string;
}

export interface ProductDetail extends ProductListItem {
  description: string;
  ingredients: string;
  benefits: string[];
  usageInstructions: string;
  skinTypes: string[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface FeaturedProducts {
  bestSellers: ProductListItem[];
  newArrivals: ProductListItem[];
  onSale: ProductListItem[];
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popular';
export type Availability = 'all' | 'in_stock' | 'out_of_stock';
