// small helpers for peso amounts, plain numbers like 100.50.
export const MAX_AMOUNT = 999_999_999.99;

// accepts commas and spaces, like "1,234.50".
export function parseAmount(input: string): number {
  const cleaned: string = input.trim().replace(/[, ]/g, '');
  if (cleaned === '') {
    throw new Error('Amount is required');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error('Invalid amount');
  }
  const value: number = Math.round(Number(cleaned) * 100) / 100;
  if (!Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) {
    throw new Error('Amount out of range');
  }
  return value;
}

const phpFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

// formats for display, like 100.5 -> ₱100.50.
export function formatAmount(amount: number): string {
  return phpFormatter.format(Math.round(amount * 100) / 100);
}
