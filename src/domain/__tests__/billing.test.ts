import { ProjectBilling, ProjectPayment } from '../../types/models';
import { safeAmount, summarizeBilling, sumSummaries } from '../billing';

const billing = (over: Partial<ProjectBilling> = {}): ProjectBilling => ({
  billing_id: 'b1',
  project_id: 'p1',
  quoted_amount: 50000,
  final_amount: 50000,
  received_amount: 0,
  pending_amount: 50000,
  gst_included: 'yes',
  ...over,
});

const pay = (id: string, amount: number, date = '2026-10-01'): ProjectPayment => ({
  payment_id: id,
  project_id: 'p1',
  amount,
  date,
  received_by: 'c_akhil',
});

describe('safeAmount', () => {
  it.each([
    [100, 100],
    ['250.50', 250.5],
    ['', 0],
    [null, 0],
    [undefined, 0],
    ['abc', 0],
    [NaN, 0],
    [Infinity, 0],
    [-5, 0],
  ])('coerces %p to %p', (input, expected) => {
    expect(safeAmount(input)).toBe(expected);
  });
});

describe('summarizeBilling', () => {
  it('derives received and pending from payment rows', () => {
    const s = summarizeBilling(billing(), [pay('a', 10000), pay('b', 15000)]);
    expect(s.received).toBe(25000);
    expect(s.pending).toBe(25000);
    expect(s.progress).toBeCloseTo(0.5);
    expect(s.paymentCount).toBe(2);
  });

  it('ignores a stale stored received_amount when payments exist', () => {
    const s = summarizeBilling(billing({ received_amount: 99999 }), [pay('a', 1000)]);
    expect(s.received).toBe(1000);
  });

  it('falls back to stored received_amount when there are no payment rows', () => {
    const s = summarizeBilling(billing({ received_amount: 20000 }), []);
    expect(s.received).toBe(20000);
    expect(s.pending).toBe(30000);
    expect(s.paymentCount).toBe(0);
  });

  it('bills the quote when no final amount is set', () => {
    const s = summarizeBilling(billing({ final_amount: 0, quoted_amount: 8000 }), []);
    expect(s.billed).toBe(8000);
    expect(s.pending).toBe(8000);
  });

  it('returns zeros and no progress for a project with no billing row', () => {
    const s = summarizeBilling(undefined, []);
    expect(s).toMatchObject({
      billed: 0,
      received: 0,
      pending: 0,
      progress: 0,
      hasBilling: false,
      overpaid: false,
    });
  });

  it('clamps pending at 0 and flags overpayment', () => {
    const s = summarizeBilling(billing({ final_amount: 1000 }), [pay('a', 1500)]);
    expect(s.pending).toBe(0);
    expect(s.progress).toBe(1);
    expect(s.overpaid).toBe(true);
  });

  it('does not drift on repeated fractional payments', () => {
    const payments = Array.from({ length: 10 }, (_, i) => pay(`p${i}`, 0.1));
    const s = summarizeBilling(billing({ final_amount: 1 }), payments);
    expect(s.received).toBe(1);
    expect(s.pending).toBe(0);
  });

  it('skips malformed payment rows (NaN, negative, zero)', () => {
    const s = summarizeBilling(billing(), [
      pay('a', NaN),
      pay('b', -500),
      pay('c', 0),
      pay('d', 2000),
    ]);
    expect(s.received).toBe(2000);
    expect(s.paymentCount).toBe(1);
  });

  it('ignores voided payments', () => {
    const s = summarizeBilling(billing({ final_amount: 1000, received_amount: 1000 }), [
      pay('a', 1000),
      { ...pay('b', 500), voided: 'yes' as const },
    ]);
    expect(s.received).toBe(1000);
    expect(s.paymentCount).toBe(1);
    expect(s.pending).toBe(0);
  });

  it('does not fall back to stored received once payments exist but are all voided', () => {
    const s = summarizeBilling(billing({ received_amount: 99999 }), [
      { ...pay('a', 500), voided: 'yes' as const },
    ]);
    expect(s.received).toBe(0);
  });

  it('reports the latest payment by date', () => {
    const s = summarizeBilling(billing(), [
      pay('a', 100, '2026-09-01'),
      pay('b', 300, '2026-10-05'),
      pay('c', 200, '2026-09-20'),
    ]);
    expect(s.lastPaymentDate).toBe('2026-10-05');
    expect(s.lastPaymentAmount).toBe(300);
  });
});

describe('sumSummaries', () => {
  it('adds up portfolio totals', () => {
    const a = summarizeBilling(billing({ final_amount: 1000 }), [pay('a', 400)]);
    const b = summarizeBilling(billing({ final_amount: 2000 }), [pay('b', 2000)]);
    expect(sumSummaries([a, b])).toEqual({
      billed: 3000,
      received: 2400,
      pending: 600,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(sumSummaries([])).toEqual({ billed: 0, received: 0, pending: 0 });
  });
});
