import type { OrderStatus, PaymentMethod, PaymentStatus } from '../types/commerce';
import type { LoyaltyEntryKind } from '../types/loyalty';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  processing: 'Đang xử lý',
  shipped: 'Đang giao hàng',
  delivered: 'Đã giao hàng',
  cancelled: 'Đã hủy',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank_transfer: 'Chuyển khoản ngân hàng',
  momo_manual: 'Ví MoMo (xác nhận thủ công)',
};

export const LOYALTY_KIND_LABELS: Record<LoyaltyEntryKind, string> = {
  accrual: 'Tích điểm',
  redemption: 'Đổi điểm',
  adjustment: 'Điều chỉnh',
  tier_change: 'Thăng hạng',
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
