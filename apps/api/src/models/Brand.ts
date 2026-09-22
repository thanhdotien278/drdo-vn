import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    country: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

brandSchema.index({ displayOrder: 1, name: 1 });

export type Brand = InferSchemaType<typeof brandSchema>;
export type BrandDocument = HydratedDocument<Brand>;
export const BrandModel = model('Brand', brandSchema);
