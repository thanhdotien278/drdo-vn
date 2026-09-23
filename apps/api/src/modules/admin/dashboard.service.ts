import { ORDER_STATUSES, OrderModel, type OrderStatus } from '../../models/Order.js';
import { ProductModel } from '../../models/Product.js';
import type { AdminDashboardDto } from './admin.dto.js';

/**
 * Story 5.1 — dashboard metrics (FR-11).
 *
 * Period boundaries use the server's local timezone: "today" starts at
 * 00:00 local and "this week" starts on the most recent Monday 00:00 local.
 * Revenue is strictly `SUM(totals.grandTotal)` over orders with
 * `paymentStatus=paid` and `orderStatus != cancelled`, grouped by `paidAt` —
 * never by `createdAt`/`deliveredAt` and never from pre-discount totals.
 */

const LOW_STOCK_LIMIT = 20;

function startOfDay(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfWeek(now: Date): Date {
  const start = startOfDay(now);
  // getDay(): 0=Sunday..6=Saturday → shift so Monday is the first day.
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

async function revenueSince(since: Date): Promise<number> {
  const [row] = await OrderModel.aggregate<{ total: number }>([
    {
      $match: {
        paymentStatus: 'paid',
        orderStatus: { $ne: 'cancelled' },
        paidAt: { $gte: since },
      },
    },
    { $group: { _id: null, total: { $sum: '$totals.grandTotal' } } },
  ]).exec();
  return row?.total ?? 0;
}

export async function getAdminDashboard(): Promise<AdminDashboardDto> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);

  const [ordersToday, ordersThisWeek, revenueToday, revenueThisWeek, statusRows, lowStock] =
    await Promise.all([
      OrderModel.countDocuments({ createdAt: { $gte: todayStart } }).exec(),
      OrderModel.countDocuments({ createdAt: { $gte: weekStart } }).exec(),
      revenueSince(todayStart),
      revenueSince(weekStart),
      OrderModel.aggregate<{ _id: OrderStatus; count: number }>([
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]).exec(),
      ProductModel.find({
        isActive: true,
        isDeleted: false,
        $expr: { $lte: ['$availableStock', '$lowStockThreshold'] },
      })
        .sort({ availableStock: 1, name: 1 })
        .limit(LOW_STOCK_LIMIT)
        .exec(),
    ]);

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const row of statusRows) {
    if (row._id in byStatus) {
      byStatus[row._id] = row.count;
    }
  }

  return {
    generatedAt: now.toISOString(),
    orders: { today: ordersToday, thisWeek: ordersThisWeek, byStatus },
    revenue: { today: revenueToday, thisWeek: revenueThisWeek },
    lowStockProducts: lowStock.map((product) => ({
      id: String(product._id),
      name: product.name,
      sku: product.sku,
      stockOnHand: product.stockOnHand,
      stockReserved: product.stockReserved,
      availableStock: Math.max(0, product.stockOnHand - product.stockReserved),
      lowStockThreshold: product.lowStockThreshold ?? 5,
    })),
  };
}
