import { AppError } from './errors';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+\-\s()]{8,20}$/;

export function requireText(value: unknown, label: string, max = 200): string {
  const text = String(value ?? '').trim();
  if (!text) throw new AppError('VALIDATION', `${label} is required.`);
  if (text.length > max) {
    throw new AppError('VALIDATION', `${label} must be ${max} characters or fewer.`);
  }
  return text;
}

export function optionalText(value: unknown, label: string, max = 500): string {
  const text = String(value ?? '').trim();
  if (text.length > max) {
    throw new AppError('VALIDATION', `${label} must be ${max} characters or fewer.`);
  }
  return text;
}

/** Blank is allowed. Anything else must be a real calendar date, YYYY-MM-DD. */
export function optionalDate(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = DATE.exec(text);
  if (!match) {
    throw new AppError('VALIDATION', `${label} must be a date like 2026-10-17.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!real) throw new AppError('VALIDATION', `${label} is not a real date.`);
  return text;
}

export function optionalEmail(value: unknown): string {
  const text = optionalText(value, 'Email', 200);
  if (!text) return '';
  if (!EMAIL.test(text)) throw new AppError('VALIDATION', 'Email does not look valid.');
  return text;
}

export function optionalPhone(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (!PHONE.test(text)) {
    throw new AppError('VALIDATION', 'Phone must be 8–20 digits (spaces and + are fine).');
  }
  return text;
}

/** Blank input becomes `fallback`. Otherwise a finite number >= min. */
export function amount(value: unknown, label: string, min: number, fallback?: number): number {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (text === '') {
    if (fallback !== undefined) return fallback;
    throw new AppError('VALIDATION', `${label} is required.`);
  }
  const n = Number(text);
  if (!Number.isFinite(n)) throw new AppError('VALIDATION', `${label} must be a number.`);
  if (n < min) throw new AppError('VALIDATION', `${label} must be ${min} or more.`);
  return Math.round(n * 100) / 100;
}

export function oneOf<T extends string>(value: unknown, label: string, allowed: readonly T[], fallback: T): T {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const found = allowed.find((item) => item === text);
  if (!found) {
    throw new AppError('VALIDATION', `${label} must be one of: ${allowed.join(', ')}.`);
  }
  return found;
}
