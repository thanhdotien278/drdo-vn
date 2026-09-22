import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Story 3.3 — customer-owned saved shipping addresses (ERD `ADDRESSES`).
 * No postal code in MVP (FR-09.6). Edits never touch order shipping
 * snapshots — orders copy these fields at checkout (FR-06.4).
 */
const addressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, default: '', trim: true },
    ward: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

addressSchema.index({ userId: 1, isDefault: -1, createdAt: 1 });

export type Address = InferSchemaType<typeof addressSchema>;
export type AddressDocument = HydratedDocument<Address>;
export const AddressModel = model('Address', addressSchema);
