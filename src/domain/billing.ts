import { ProjectBilling, ProjectPayment } from '../types/models';

/** Money is INR; keep arithmetic in whole paise to avoid float drift. */
const toPaise = (n: number): number => Math.round(n * 100);
const fromPaise = (p: number): number => p / 100;

/** Coerce spreadsheet values (strings, blanks, NaN) into a safe, non-negative number. */
export function safeAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface BillingSummary {
  quoted: number;
  /** The amount actually billed: final if set, otherwise the quote. */
  billed: number;
  received: number;
  pending: number;
  /** received / billed, clamped to 0..1. 0 when nothing has been billed. */
  progress: number;
  paymentCount: number;
  lastPaymentDate: string;
  lastPaymentAmount: number;
  hasBilling: boolean;
  /** True when received exceeds billed (client overpaid / data needs review). */
  overpaid: boolean;
}

/**
 * Single source of truth for "how much has this project billed / collected".
 *
 * Received is derived from the payment rows. The stored `received_amount` is
 * only used as a fallback when a project has no payment rows at all, so the
 * denormalised sheet columns can never make the Projects list and the
 * detail screen disagree.
 */
export function summarizeBilling(
  billing: ProjectBilling | undefined,
  payments: ProjectPayment[],
): BillingSummary {
  const quoted = safeAmount(billing?.quoted_amount);
  const final = safeAmount(billing?.final_amount);
  const billed = final > 0 ? final : quoted;

  // A voided payment stays in the list (so it can be audited) but does not count.
  // Once any payment row exists, received comes only from the live ones — a
  // stored received_amount must not resurrect money after a void.
  const live = payments.filter((p) => p.voided !== 'yes');
  const valid = live.filter((p) => safeAmount(p.amount) > 0);
  const paymentsPaise = valid.reduce((sum, p) => sum + toPaise(safeAmount(p.amount)), 0);
  const received =
    payments.length > 0
      ? fromPaise(paymentsPaise)
      : safeAmount(billing?.received_amount);

  const pending = fromPaise(Math.max(0, toPaise(billed) - toPaise(received)));
  const progress = billed > 0 ? Math.min(1, received / billed) : 0;

  const latest = [...valid].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')),
  )[0];

  return {
    quoted,
    billed,
    received,
    pending,
    progress,
    paymentCount: valid.length,
    lastPaymentDate: latest?.date ?? '',
    lastPaymentAmount: latest ? safeAmount(latest.amount) : 0,
    hasBilling: Boolean(billing),
    overpaid: billed > 0 && toPaise(received) > toPaise(billed),
  };
}

export interface PortfolioTotals {
  billed: number;
  received: number;
  pending: number;
}

export function sumSummaries(summaries: BillingSummary[]): PortfolioTotals {
  const billed = summaries.reduce((s, x) => s + toPaise(x.billed), 0);
  const received = summaries.reduce((s, x) => s + toPaise(x.received), 0);
  const pending = summaries.reduce((s, x) => s + toPaise(x.pending), 0);
  return {
    billed: fromPaise(billed),
    received: fromPaise(received),
    pending: fromPaise(pending),
  };
}
