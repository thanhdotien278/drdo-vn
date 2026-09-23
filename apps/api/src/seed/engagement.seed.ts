import { BannerModel } from '../models/Banner.js';
import { ProductModel } from '../models/Product.js';
import { ReviewModel } from '../models/Review.js';
import { UserModel } from '../models/User.js';
import { WishlistItemModel } from '../models/WishlistItem.js';
import { recomputeProductRating } from '../modules/reviews/review.service.js';
import { publicUploadUrl, uploadsDir } from '../utils/uploads.js';
import { writePlaceholderImage } from './productImage.js';

const DAY = 24 * 3600 * 1000;

/**
 * Epic 7 — sample wishlist entries, moderated reviews, and banners in the
 * three window states the QA checklist exercises (active, scheduled, expired).
 * Idempotent: re-running replaces the seed customer's wishlist/reviews and
 * the seeded banner set. The catalog seeder recreates products with fresh
 * ids, so upserts keyed on productId would otherwise leave orphaned rows.
 */
export async function seedEngagement(): Promise<string> {
  const customer = await UserModel.findOne({ email: 'customer@drdo.vn' }).exec();
  if (!customer) {
    throw new Error('Seed customer@drdo.vn missing — run the users seeder first');
  }

  // --- Banners: one live, one scheduled, one expired, one switched off ---
  const bannerDir = uploadsDir('banners');
  const bannerSeeds = [
    {
      fileName: 'seed-banner-active.svg',
      title: 'Tuần lễ chăm da',
      subtitle: 'Ưu đãi tới 30% cho set dưỡng da ban đêm',
      linkUrl: '/products?sort=popular',
      displayOrder: 0,
      isActive: true,
      startAt: null as Date | null,
      endAt: null as Date | null,
      colors: ['#2f5d33', '#94a984'] as [string, string],
    },
    {
      fileName: 'seed-banner-scheduled.svg',
      title: 'Sắp diễn ra: Ngày hội serum',
      subtitle: 'Banner đã lên lịch — chưa hiển thị',
      linkUrl: '/products',
      displayOrder: 1,
      isActive: true,
      startAt: new Date(Date.now() + 30 * DAY),
      endAt: null,
      colors: ['#b4552d', '#d9a428'] as [string, string],
    },
    {
      fileName: 'seed-banner-expired.svg',
      title: 'Flash sale hè (đã kết thúc)',
      subtitle: 'Banner hết hạn — không hiển thị',
      linkUrl: '/products',
      displayOrder: 2,
      isActive: true,
      startAt: new Date(Date.now() - 60 * DAY),
      endAt: new Date(Date.now() - DAY),
      colors: ['#5e6b58', '#cfc9b6'] as [string, string],
    },
    {
      fileName: 'seed-banner-inactive.svg',
      title: 'Banner đang tắt',
      subtitle: 'isActive=false — không hiển thị',
      linkUrl: '',
      displayOrder: 3,
      isActive: false,
      startAt: null,
      endAt: null,
      colors: ['#17261a', '#5e6b58'] as [string, string],
    },
  ];

  await BannerModel.deleteMany({ imageUrl: { $regex: '^/uploads/banners/seed-banner-' } }).exec();
  for (const seed of bannerSeeds) {
    await writePlaceholderImage(bannerDir, {
      fileName: seed.fileName,
      title: seed.title,
      subtitle: seed.subtitle,
      colors: seed.colors,
      variant: seed.displayOrder,
    });
    await BannerModel.create({
      imageUrl: publicUploadUrl('banners', seed.fileName),
      imageAlt: seed.title,
      title: seed.title,
      subtitle: seed.subtitle,
      linkUrl: seed.linkUrl,
      displayOrder: seed.displayOrder,
      startAt: seed.startAt,
      endAt: seed.endAt,
      isActive: seed.isActive,
    });
  }

  // --- Wishlist entries for the seed customer ---
  const wishlistSkus = ['SBM-TNR-150', 'ANS-UVM-060'];
  await WishlistItemModel.deleteMany({ userId: customer._id }).exec();
  let wishlistCount = 0;
  for (const sku of wishlistSkus) {
    const product = await ProductModel.findOne({ sku }).exec();
    if (!product) continue;
    await WishlistItemModel.create({ userId: customer._id, productId: product._id });
    wishlistCount += 1;
  }

  // --- Reviews in both moderation states on products the customer ordered ---
  const reviewSeeds = [
    { sku: 'LRP-EFC-400', rating: 5, comment: 'Thấm nhanh, không nhờn. Dùng đều đặn thấy da sáng hơn.', status: 'approved' as const },
    { sku: 'CCN-RMA-310', rating: 4, comment: 'Mùi trà xanh dễ chịu, cấp ẩm ổn.', status: 'pending' as const },
  ];
  await ReviewModel.deleteMany({ userId: customer._id }).exec();
  let reviewCount = 0;
  for (const seed of reviewSeeds) {
    const product = await ProductModel.findOne({ sku: seed.sku }).exec();
    if (!product) continue;
    await ReviewModel.create({
      userId: customer._id,
      productId: product._id,
      rating: seed.rating,
      comment: seed.comment,
      status: seed.status,
    });
    await recomputeProductRating(product._id);
    reviewCount += 1;
  }

  return `${bannerSeeds.length} banners, ${wishlistCount} wishlist items, ${reviewCount} reviews`;
}
