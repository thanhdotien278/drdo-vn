import type { BannerDocument } from '../../models/Banner.js';

export interface PublicBannerDto {
  id: string;
  imageUrl: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  linkUrl: string;
}

export interface AdminBannerDto extends PublicBannerDto {
  displayOrder: number;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export function toPublicBannerDto(banner: BannerDocument): PublicBannerDto {
  return {
    id: String(banner._id),
    imageUrl: banner.imageUrl,
    imageAlt: banner.imageAlt ?? '',
    title: banner.title ?? '',
    subtitle: banner.subtitle ?? '',
    linkUrl: banner.linkUrl ?? '',
  };
}

export function toAdminBannerDto(banner: BannerDocument): AdminBannerDto {
  return {
    ...toPublicBannerDto(banner),
    displayOrder: banner.displayOrder ?? 0,
    startAt: banner.startAt ? banner.startAt.toISOString() : null,
    endAt: banner.endAt ? banner.endAt.toISOString() : null,
    isActive: banner.isActive,
    isDeleted: banner.isDeleted,
    createdAt: banner.createdAt.toISOString(),
  };
}
