import type { UserRole } from './auth';
import type { Brand, Category, ProductImage } from './catalog';
import type { OrderListItem, OrderStatus } from './commerce';

export interface AdminCategory extends Category {
  isActive: boolean;
  isDeleted: boolean;
}

export interface AdminBrand extends Brand {
  displayOrder: number;
  isActive: boolean;
  isDeleted: boolean;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  benefits: string[];
  usageInstructions: string;
  volume: string;
  skinTypes: string[];
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  images: ProductImage[];
  category: Category | null;
  brand: Brand | null;
  stockOnHand: number;
  stockReserved: number;
  availableStock: number;
  lowStockThreshold: number;
  soldCount: number;
  ratingAverage: number;
  ratingCount: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface AdminCustomer {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  status: 'active' | 'blocked' | 'inactive';
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminCustomerDetail {
  customer: AdminCustomer;
  orders: OrderListItem[];
}

export interface AdminStaff extends AdminCustomer {
  roles: UserRole[];
}

export interface AdminDashboard {
  generatedAt: string;
  orders: {
    today: number;
    thisWeek: number;
    byStatus: Record<OrderStatus, number>;
  };
  revenue: {
    today: number;
    thisWeek: number;
  };
  lowStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
    stockOnHand: number;
    stockReserved: number;
    availableStock: number;
    lowStockThreshold: number;
  }>;
}

export interface AdminAuditLog {
  id: string;
  actor: { userId: string | null; role: string | null; label: string };
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  nextValue: unknown;
  note: string;
  createdAt: string;
}
