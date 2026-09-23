import type {
  AdminAuditLog,
  AdminBrand,
  AdminCategory,
  AdminCustomer,
  AdminCustomerDetail,
  AdminDashboard,
  AdminProduct,
  AdminStaff,
} from '../types/admin';
import type { UserRole } from '../types/auth';
import type { PageMeta } from '../types/catalog';
import { apiGet, apiRequest, apiUpload } from './client';
import { staffOrdersApi } from './staffOrders';

/** Epic 5 — admin API surface. Order operations reuse the shared staff API. */
export const adminOrders = staffOrdersApi('admin');

// ---------- Dashboard / audit ----------

export function fetchAdminDashboard(): Promise<{ data: AdminDashboard }> {
  return apiGet<AdminDashboard>('/admin/dashboard');
}

export function fetchAdminAuditLogs(params: {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
}): Promise<{ data: AdminAuditLog[]; meta?: unknown }> {
  return apiGet<AdminAuditLog[]>('/admin/audit-logs', params);
}

// ---------- Products ----------

export interface AdminProductQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'all' | 'active' | 'inactive' | 'deleted';
}

export async function fetchAdminProducts(
  query: AdminProductQuery = {},
): Promise<{ items: AdminProduct[]; meta: PageMeta }> {
  const result = await apiGet<AdminProduct[]>('/admin/products', {
    page: query.page,
    limit: query.limit ?? 12,
    q: query.q || undefined,
    status: query.status && query.status !== 'all' ? query.status : undefined,
  });
  return { items: result.data, meta: result.meta as PageMeta };
}

export function fetchAdminProduct(id: string): Promise<{ data: AdminProduct }> {
  return apiGet<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`);
}

export interface AdminProductInput {
  name: string;
  slug?: string;
  sku: string;
  shortDescription?: string;
  description?: string;
  ingredients?: string;
  benefits?: string[];
  usageInstructions?: string;
  volume?: string;
  skinTypes?: string[];
  price: number;
  salePrice?: number | null;
  stockOnHand?: number;
  lowStockThreshold?: number;
  category: string;
  brand: string;
  isActive?: boolean;
}

export function createAdminProduct(input: AdminProductInput): Promise<{ data: AdminProduct }> {
  return apiRequest<AdminProduct>('POST', '/admin/products', { body: input });
}

export function updateAdminProduct(
  id: string,
  input: Partial<AdminProductInput>,
): Promise<{ data: AdminProduct }> {
  return apiRequest<AdminProduct>('PATCH', `/admin/products/${encodeURIComponent(id)}`, {
    body: input,
  });
}

export function deleteAdminProduct(id: string): Promise<{ data: AdminProduct }> {
  return apiRequest<AdminProduct>('DELETE', `/admin/products/${encodeURIComponent(id)}`);
}

export function uploadAdminProductImages(
  id: string,
  files: File[],
  alt?: string,
): Promise<{ data: AdminProduct }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }
  if (alt) formData.append('alt', alt);
  return apiUpload<AdminProduct>(
    'POST',
    `/admin/products/${encodeURIComponent(id)}/images`,
    formData,
  );
}

export function replaceAdminProductImage(
  id: string,
  imageId: string,
  file: File,
): Promise<{ data: AdminProduct }> {
  const formData = new FormData();
  formData.append('image', file);
  return apiUpload<AdminProduct>(
    'PATCH',
    `/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`,
    formData,
  );
}

export function deleteAdminProductImage(
  id: string,
  imageId: string,
): Promise<{ data: AdminProduct }> {
  return apiRequest<AdminProduct>(
    'DELETE',
    `/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`,
  );
}

// ---------- Categories / brands ----------

export interface AdminTaxonomyInput {
  name: string;
  slug?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  imageUrl?: string;
  logoUrl?: string;
  country?: string;
}

export function fetchAdminCategories(): Promise<{ data: AdminCategory[] }> {
  return apiGet<AdminCategory[]>('/admin/categories');
}

export function createAdminCategory(input: AdminTaxonomyInput): Promise<{ data: AdminCategory }> {
  return apiRequest<AdminCategory>('POST', '/admin/categories', { body: input });
}

export function updateAdminCategory(
  id: string,
  input: Partial<AdminTaxonomyInput>,
): Promise<{ data: AdminCategory }> {
  return apiRequest<AdminCategory>('PATCH', `/admin/categories/${encodeURIComponent(id)}`, {
    body: input,
  });
}

export function deleteAdminCategory(id: string): Promise<{ data: { ok: true } }> {
  return apiRequest<{ ok: true }>('DELETE', `/admin/categories/${encodeURIComponent(id)}`);
}

export function fetchAdminBrands(): Promise<{ data: AdminBrand[] }> {
  return apiGet<AdminBrand[]>('/admin/brands');
}

export function createAdminBrand(input: AdminTaxonomyInput): Promise<{ data: AdminBrand }> {
  return apiRequest<AdminBrand>('POST', '/admin/brands', { body: input });
}

export function updateAdminBrand(
  id: string,
  input: Partial<AdminTaxonomyInput>,
): Promise<{ data: AdminBrand }> {
  return apiRequest<AdminBrand>('PATCH', `/admin/brands/${encodeURIComponent(id)}`, {
    body: input,
  });
}

export function deleteAdminBrand(id: string): Promise<{ data: { ok: true } }> {
  return apiRequest<{ ok: true }>('DELETE', `/admin/brands/${encodeURIComponent(id)}`);
}

// ---------- Customers ----------

export interface AdminCustomerQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: '' | 'active' | 'blocked' | 'inactive';
}

export async function fetchAdminCustomers(
  query: AdminCustomerQuery = {},
): Promise<{ items: AdminCustomer[]; meta: PageMeta }> {
  const result = await apiGet<AdminCustomer[]>('/admin/customers', {
    page: query.page,
    limit: query.limit ?? 12,
    q: query.q || undefined,
    status: query.status || undefined,
  });
  return { items: result.data, meta: result.meta as PageMeta };
}

export function fetchAdminCustomer(id: string): Promise<{ data: AdminCustomerDetail }> {
  return apiGet<AdminCustomerDetail>(`/admin/customers/${encodeURIComponent(id)}`);
}

export function setAdminCustomerStatus(
  id: string,
  status: 'active' | 'blocked',
  note?: string,
): Promise<{ data: AdminCustomer }> {
  return apiRequest<AdminCustomer>('PATCH', `/admin/customers/${encodeURIComponent(id)}/status`, {
    body: { status, ...(note ? { note } : {}) },
  });
}

// ---------- Staff ----------

export function fetchAdminStaff(): Promise<{ data: AdminStaff[] }> {
  return apiGet<AdminStaff[]>('/admin/staff');
}

export function createAdminStaff(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: 'admin' | 'employee';
}): Promise<{ data: AdminStaff }> {
  return apiRequest<AdminStaff>('POST', '/admin/staff', { body: input });
}

export function setAdminStaffRole(
  id: string,
  role: UserRole,
  note?: string,
): Promise<{ data: AdminStaff }> {
  return apiRequest<AdminStaff>('PATCH', `/admin/staff/${encodeURIComponent(id)}/role`, {
    body: { role, ...(note ? { note } : {}) },
  });
}

export function setAdminStaffStatus(
  id: string,
  status: 'active' | 'inactive',
  note?: string,
): Promise<{ data: AdminStaff }> {
  return apiRequest<AdminStaff>('PATCH', `/admin/staff/${encodeURIComponent(id)}/status`, {
    body: { status, ...(note ? { note } : {}) },
  });
}
