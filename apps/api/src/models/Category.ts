import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

categorySchema.index({ displayOrder: 1, name: 1 });

export type Category = InferSchemaType<typeof categorySchema>;
export type CategoryDocument = HydratedDocument<Category>;
export const CategoryModel = model('Category', categorySchema);
