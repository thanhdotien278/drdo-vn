import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Per-day atomic sequence behind `Order.orderNo` (DRD-YYYYMMDD-NNNN). One
 * document per Vietnam calendar day; `findOneAndUpdate` + `$inc` + `upsert`
 * claims the next number in a single round-trip, so concurrent checkouts
 * can never draw the same sequence — and a new day simply starts a new
 * document at 1.
 */
const orderCounterSchema = new Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export type OrderCounter = InferSchemaType<typeof orderCounterSchema>;
export type OrderCounterDocument = HydratedDocument<OrderCounter>;
export const OrderCounterModel = model('OrderCounter', orderCounterSchema);
