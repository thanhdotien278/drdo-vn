const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatVnd(amount: number): string {
  return vndFormatter.format(amount);
}

export function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',');
}
