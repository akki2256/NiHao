import { AppError } from '../errors';
import { amount, optionalDate, optionalEmail, optionalPhone, requireText } from '../validation';

describe('requireText', () => {
  it.each([
    ['  ', 'Client name'],
    ['', 'Task name'],
    [null, 'Title'],
  ])('rejects blank %p', (value, label) => {
    expect(() => requireText(value, label)).toThrow(AppError);
  });

  it('trims and returns the text', () => {
    expect(requireText('  Yog  ', 'Client name')).toBe('Yog');
  });

  it('rejects text over the limit', () => {
    expect(() => requireText('a'.repeat(121), 'Client name', 120)).toThrow(/120/);
  });
});

describe('optionalDate', () => {
  it.each([
    ['2026-10-17', '2026-10-17'],
    ['', ''],
    ['   ', ''],
  ])('accepts %p', (value, expected) => {
    expect(optionalDate(value, 'Date')).toBe(expected);
  });

  it.each(['17-10-2026', '2026/10/17', '2026-02-31', '2026-13-01', 'yesterday'])(
    'rejects %p',
    (value) => {
      expect(() => optionalDate(value, 'Date')).toThrow(AppError);
    },
  );
});

describe('optionalEmail and phone', () => {
  it.each([
    ['akhil@calicon.in', 'akhil@calicon.in'],
    ['', ''],
  ])('accepts email %p', (value, expected) => {
    expect(optionalEmail(value)).toBe(expected);
  });

  it.each(['akhil', 'a@b', 'a @b.com'])('rejects email %p', (value) => {
    expect(() => optionalEmail(value)).toThrow(/Email/);
  });

  it.each(['9000000001', '+91 90000 00001', ''])('accepts phone %p', (value) => {
    expect(optionalPhone(value)).toBe(value);
  });

  it.each(['123', 'phone', '12345'])('rejects phone %p', (value) => {
    expect(() => optionalPhone(value)).toThrow(/Phone/);
  });
});

describe('amount', () => {
  it.each([
    ['1,000.50', 0, 1000.5],
    [0, 0, 0],
    ['0', 0, 0],
  ])('parses %p', (value, min, expected) => {
    expect(amount(value, 'Amount', min)).toBe(expected);
  });

  it.each(['abc', '-1', 'NaN', ''])('rejects %p when there is no fallback', (value) => {
    expect(() => amount(value, 'Amount', 0)).toThrow(AppError);
  });

  it('rejects zero when a positive amount is required', () => {
    expect(() => amount(0, 'Amount', 0.01)).toThrow(/0.01/);
  });

  it('uses the fallback for a blank update', () => {
    expect(amount('', 'Quoted amount', 0, 500)).toBe(500);
  });
});
