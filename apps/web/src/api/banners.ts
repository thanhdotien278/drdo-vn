import type { PageMeta } from '../types/catalog';
import type { AdminBanner, PublicBanner } from '../types/engagement';
import { apiGet, apiRequest, apiUpload } from './client';

/** Public storefront feed — active, in-window banners only (Story 7.5). */
export function fetchPublicBanners(): Promise<{ data: PublicBanner[] }> {
  return apiGet<PublicBanner[]>('/banners');
}

export type BannerStatusFilter = 'all' | 'active' | 'inactive' | 'deleted';

export interface BannerFormFields {
  title?: string;
  subtitle?: string;
  imageAlt?: string;
  linkUrl?: string;
  displayOrder?: number;
  startAt?: string;
  endAt?: string;
  isActive?: boolean;
}

function toFormData(fields: BannerFormFields, image?: File | null): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      // Empty strings are meaningful: they clear the field server-side.
      form.append(key, String(value));
    }
  }
  if (image) {
    form.append('image', image);
  }
  return form;
}

export async function fetchAdminBanners(
  query: { status?: BannerStatusFilter; page?: number } = {},
): Promise<{ items: AdminBanner[]; meta: PageMeta }> {
  const result = await apiGet<AdminBanner[]>('/admin/banners', {
    status: query.status ?? 'all',
    page: query.page,
    limit: 10,
  });
  return { items: result.data, meta: result.meta as PageMeta };
}

export function createAdminBanner(
  fields: BannerFormFields,
  image: File,
): Promise<{ data: AdminBanner }> {
  return apiUpload<AdminBanner>('POST', '/admin/banners', toFormData(fields, image));
}

export function updateAdminBanner(
  id: string,
  fields: BannerFormFields,
  image?: File | null,
): Promise<{ data: AdminBanner }> {
  return apiUpload<AdminBanner>(
    'PATCH',
    `/admin/banners/${encodeURIComponent(id)}`,
    toFormData(fields, image),
  );
}

export function deleteAdminBanner(id: string): Promise<{ data: AdminBanner }> {
  return apiRequest<AdminBanner>('DELETE', `/admin/banners/${encodeURIComponent(id)}`);
}
