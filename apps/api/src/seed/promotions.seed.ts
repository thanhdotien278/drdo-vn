import { BrandModel } from '../models/Brand.js';
import { CategoryModel } from '../models/Category.js';
import { CouponModel } from '../models/Coupon.js';
import { PromotionModel } from '../models/Promotion.js';

const DAY = 24 * 3600 * 1000;

/**
 * Epic 9 — promotions + coupons covering every QA §14.5 rejection case plus
 * the happy paths (percentage with cap, fixed amount, brand/category scope,
 * tier restriction, min order, usage limits, inactive/not-started/expired).
 * Idempotent: promotions upsert by name, coupons upsert by code, so re-runs
 * never clobber admin edits on existing rows.
 */
export async function seedPromotions(): Promise<string> {
  const cocoon = await BrandModel.findOne({ slug: 'cocoon' }).exec();
  const serumCategory = await CategoryModel.findOne({ slug: 'serum' }).exec();
  if (!cocoon || !serumCategory) {
    throw new Error('Seed catalog missing — run the catalog seeder first');
  }

  const now = Date.now();
  const promotionSeeds: Array<{
    name: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    maxDiscountAmount?: number | null;
    startAt?: Date | null;
    endAt?: Date | null;
    minOrderTotal?: number;
    productIds?: never[];
    categoryIds?: unknown[];
    brandIds?: unknown[];
    tierCodes?: string[];
    isActive?: boolean;
  }> = [
    // Active, sitewide, capped percentage — the happy-path coupon.
    { name: 'Giảm 10% toàn shop', discountType: 'percentage', discountValue: 10, maxDiscountAmount: 50_000 },
    // Fixed amount with a minimum order.
    { name: 'Giảm 50k đơn từ 300k', discountType: 'fixed_amount', discountValue: 50_000, minOrderTotal: 300_000 },
    // Scoped to a brand — the discount base is only Cocoon lines.
    { name: 'Giảm 20% cho Cocoon', discountType: 'percentage', discountValue: 20, brandIds: [cocoon._id] },
    // Scoped to a category.
    { name: 'Giảm 15% cho serum', discountType: 'percentage', discountValue: 15, categoryIds: [serumCategory._id] },
    // Not started yet.
    { name: 'Flash sale sắp diễn ra', discountType: 'percentage', discountValue: 25, startAt: new Date(now + 7 * DAY) },
    // Expired window.
    { name: 'Ưu đãi đã kết thúc', discountType: 'fixed_amount', discountValue: 30_000, startAt: new Date(now - 30 * DAY), endAt: new Date(now - DAY) },
    // Switched off entirely.
    { name: 'Chương trình đã tắt', discountType: 'percentage', discountValue: 10, isActive: false },
    // Tier-restricted: GOLD and PLATINUM only.
    { name: 'Ưu đãi hạng Vàng+', discountType: 'percentage', discountValue: 15, tierCodes: ['GOLD', 'PLATINUM'] },
  ];

  const promotionIdByName = new Map<string, unknown>();
  for (const seed of promotionSeeds) {
    const promotion = await PromotionModel.findOneAndUpdate(
      { name: seed.name },
      { $setOnInsert: { minOrderTotal: 0, isActive: true, ...seed } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
    promotionIdByName.set(seed.name, promotion!._id);
  }

  const couponSeeds: Array<{
    code: string;
    promotionName: string;
    usageLimitTotal?: number | null;
    usageLimitPerCustomer?: number | null;
    isActive?: boolean;
  }> = [
    { code: 'DRDO10', promotionName: 'Giảm 10% toàn shop' },
    { code: 'FIXED50', promotionName: 'Giảm 50k đơn từ 300k' },
    { code: 'COCOON20', promotionName: 'Giảm 20% cho Cocoon' },
    { code: 'SERUM15', promotionName: 'Giảm 15% cho serum' },
    { code: 'FUTURE25', promotionName: 'Flash sale sắp diễn ra' },
    { code: 'EXPIRED30', promotionName: 'Ưu đãi đã kết thúc' },
    { code: 'OFF10', promotionName: 'Chương trình đã tắt' },
    { code: 'GOLD15', promotionName: 'Ưu đãi hạng Vàng+' },
    // Usage-limited coupon: 5 total redemptions, 1 per customer.
    { code: 'LIMITED5', promotionName: 'Giảm 10% toàn shop', usageLimitTotal: 5, usageLimitPerCustomer: 1 },
    // Disabled coupon on a live promotion — indistinguishable COUPON_INACTIVE.
    { code: 'DEAD10', promotionName: 'Giảm 10% toàn shop', isActive: false },
  ];

  for (const seed of couponSeeds) {
    const promotionId = promotionIdByName.get(seed.promotionName);
    await CouponModel.findOneAndUpdate(
      { code: seed.code },
      {
        $setOnInsert: {
          code: seed.code,
          promotionId,
          usageLimitTotal: seed.usageLimitTotal ?? null,
          usageLimitPerCustomer: seed.usageLimitPerCustomer ?? null,
          isActive: seed.isActive ?? true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
  }

  return `${promotionSeeds.length} promotions, ${couponSeeds.length} coupons`;
}
