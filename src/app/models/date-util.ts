// dates stay as plain YYYY-MM-DD text so sorting is just string order.
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidExpenseDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parts: string[] = value.split('-');
  if (parts.length !== 3) {
    return false;
  }
  const year: number = Number(parts[0]);
  const month: number = Number(parts[1]);
  const day: number = Number(parts[2]);
  const check = new Date(year, month - 1, day);
  return check.getFullYear() === year && check.getMonth() === month - 1 && check.getDate() === day;
}

export function compareExpenseDatesDesc(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? 1 : -1;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// bad input returns as-is so templates never crash.
export function formatDate(value: string): string {
  if (!isValidExpenseDate(value)) {
    return value;
  }
  const parts: string[] = value.split('-');
  const year: number = Number(parts[0]);
  const month: number = Number(parts[1]);
  const day: number = Number(parts[2]);
  return `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}, ${year}`;
}

// bad input returns as-is so templates never crash.
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return value;
  }
  const day: string = `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
  const suffix: string = date.getHours() < 12 ? 'AM' : 'PM';
  const hour: number = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
  return `${day} ${hour}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`;
}

// plain string compare works since dates are YYYY-MM-DD text.
export function isFutureDate(value: string): boolean {
  if (!isValidExpenseDate(value)) {
    return false;
  }
  const now = new Date();
  const today: string = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return value > today;
}

export function sortExpenseDatesNewestFirst(dates: readonly string[]): string[] {
  return [...dates].sort(compareExpenseDatesDesc);
}
