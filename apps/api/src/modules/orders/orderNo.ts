import { OrderCounterModel } from '../../models/OrderCounter.js';

const ORDER_NO_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const ORDER_NO_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: ORDER_NO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * `YYYYMMDD` of the Vietnam calendar day containing `now`. The business
 * day is pinned to Asia/Ho_Chi_Minh, so the key is identical no matter
 * which timezone the server runs in.
 */
export function orderDayKey(now: Date = new Date()): string {
  const parts = ORDER_NO_DATE_FORMAT.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  return `${part('year')}${part('month')}${part('day')}`;
}

/**
 * `DRD-YYYYMMDD-NNNN` — date is the Vietnam calendar day, NNNN is a
 * per-day sequence starting at 0001 and resetting when the day rolls
 * over. The sequence is claimed with a single atomic
 * findOneAndUpdate($inc, upsert) on `ordercounters`, so concurrent
 * checkouts can never draw the same number; a sequence value burned by a
 * later-failing checkout is simply a gap, never a duplicate.
 */
export async function nextOrderNo(now: Date = new Date()): Promise<string> {
  const key = orderDayKey(now);
  const counter = await OrderCounterModel.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).exec();
  return `DRD-${key}-${String(counter!.seq).padStart(4, '0')}`;
}
