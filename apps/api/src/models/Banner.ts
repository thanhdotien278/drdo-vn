import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Story 7.5 — storefront banners (ERD `BANNERS`). `imageUrl` stores only the
 * `/uploads/banners/<file>` path metadata — the same local storage rule as
 * product images. `startAt`/`endAt` are nullable for open-ended windows; the
 * public feed keeps only `isActive && !isDeleted` banners whose window covers
 * the current time, ordered by `displayOrder`.
 */
const bannerSchema = new Schema(
  {
    imageUrl: { type: String, required: true },
    imageAlt: { type: String, default: '', trim: true },
    title: { type: String, default: '', trim: true, maxlength: 200 },
    subtitle: { type: String, default: '', trim: true, maxlength: 500 },
    linkUrl: { type: String, default: '', trim: true, maxlength: 500 },
    displayOrder: { type: Number, required: true, default: 0, min: 0 },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

bannerSchema.index({ isActive: 1, isDeleted: 1, displayOrder: 1 });

export type Banner = InferSchemaType<typeof bannerSchema>;
export type BannerDocument = HydratedDocument<Banner>;
export const BannerModel = model('Banner', bannerSchema);
