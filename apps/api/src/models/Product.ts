import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const productImageSchema = new Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    shortDescription: { type: String, default: '' },
    description: { type: String, default: '' },
    ingredients: { type: String, default: '' },
    benefits: { type: [String], default: [] },
    usageInstructions: { type: String, default: '' },
    volume: { type: String, default: '' },
    skinTypes: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    images: { type: [productImageSchema], default: [] },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    stockOnHand: { type: Number, required: true, min: 0, default: 0 },
    stockReserved: { type: Number, required: true, min: 0, default: 0 },
    availableStock: { type: Number, default: 0, min: 0, index: true },
    effectivePrice: { type: Number, default: 0, min: 0, index: true },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

productSchema.pre('validate', function syncDerivedFields(next) {
  const salePrice = typeof this.salePrice === 'number' ? this.salePrice : null;
  this.effectivePrice =
    salePrice !== null && salePrice > 0 && salePrice < this.price ? salePrice : this.price;
  this.availableStock = Math.max(0, (this.stockOnHand ?? 0) - (this.stockReserved ?? 0));
  next();
});

productSchema.index({ createdAt: -1 });
productSchema.index({ soldCount: -1 });

export type Product = InferSchemaType<typeof productSchema>;
export type ProductDocument = HydratedDocument<Product>;
export const ProductModel = model('Product', productSchema);
