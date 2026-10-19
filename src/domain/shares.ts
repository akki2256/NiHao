import {
  AppData,
  Expense,
  ProjectBilling,
  ProjectPayment,
  Settlement,
} from '../types/models';

/** India GST-inclusive divisor. Effective amount = gross / 1.18. */
export const GST_DIVISOR = 1.18;

export function toPaise(amount: unknown): number {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/** Splits a GST-inclusive gross into the net the team shares and the tax set aside. */
export function inclusiveGst(grossPaise: number): { netPaise: number; gstPaise: number } {
  if (grossPaise <= 0) return { netPaise: 0, gstPaise: 0 };
  const netPaise = Math.round(grossPaise / GST_DIVISOR);
  return { netPaise, gstPaise: grossPaise - netPaise };
}

/**
 * Equal integer shares that add up to the total.
 * The earliest entries get one extra paisa when it does not divide evenly.
 */
export function equalShares(totalPaise: number, count: number): number[] {
  if (count <= 0) return [];
  if (totalPaise <= 0) return Array.from({ length: count }, () => 0);
  const base = Math.floor(totalPaise / count);
  let extra = totalPaise - base * count;
  return Array.from({ length: count }, () => base + (extra-- > 0 ? 1 : 0));
}

export interface ShareLine {
  contributorId: string;
  paise: number;
}

/** Positive paise means `fromId` owes `toId`. */
export interface BalanceEdge {
  fromId: string;
  toId: string;
  paise: number;
}

export interface ProjectShares {
  memberIds: string[];
  gst: boolean;
  /** Net of the final bill (or the quote when no final is set), after GST. */
  billNetPaise: number;
  billGstPaise: number;
  billShares: ShareLine[];
  /** Net of client payments received so far, after GST. */
  receivedNetPaise: number;
  receivedShares: ShareLine[];
  /** GST sitting with whoever received the client payment. Not shared. */
  gstHeld: ShareLine[];
  /** Who owes whom on this project, after transfers linked to it. */
  edges: BalanceEdge[];
}

function linkedIds(
  rows: { contributor_id: string; active_status?: string; project_id?: string; expense_id?: string }[],
  key: 'project_id' | 'expense_id',
  parentId: string,
): string[] {
  return [
    ...new Set(
      rows
        .filter((row) => row[key] === parentId && row.active_status !== 'inactive')
        .map((row) => row.contributor_id),
    ),
  ].sort();
}

function billedGross(billing: ProjectBilling | undefined): number {
  const finalAmount = toPaise(billing?.final_amount);
  const quoted = toPaise(billing?.quoted_amount);
  return finalAmount > 0 ? finalAmount : quoted;
}

function pushEdge(edges: BalanceEdge[], fromId: string, toId: string, paise: number) {
  if (!fromId || !toId || fromId === toId || paise <= 0) return;
  edges.push({ fromId, toId, paise });
}

/** Collapses every edge between a pair into a single direction. */
export function netEdges(edges: BalanceEdge[]): BalanceEdge[] {
  const totals = new Map<string, number>();
  for (const edge of edges) {
    if (!edge.fromId || !edge.toId || edge.fromId === edge.toId || edge.paise <= 0) continue;
    const [low, high, sign] =
      edge.fromId < edge.toId
        ? [edge.fromId, edge.toId, 1]
        : [edge.toId, edge.fromId, -1];
    const key = `${low}|${high}`;
    totals.set(key, (totals.get(key) || 0) + sign * edge.paise);
  }
  const out: BalanceEdge[] = [];
  for (const [key, value] of totals) {
    if (value === 0) continue;
    const [low, high] = key.split('|');
    if (value > 0) out.push({ fromId: low, toId: high, paise: value });
    else out.push({ fromId: high, toId: low, paise: -value });
  }
  return out.sort((a, b) => b.paise - a.paise || a.fromId.localeCompare(b.fromId));
}

function lines(ids: string[], shares: number[]): ShareLine[] {
  return ids.map((contributorId, index) => ({
    contributorId,
    paise: shares[index] || 0,
  }));
}

export function projectShares(
  billing: ProjectBilling | undefined,
  payments: ProjectPayment[],
  memberIds: string[],
  settlements: Settlement[] = [],
): ProjectShares {
  const members = [...new Set(memberIds)].sort();
  const gst = billing?.gst_included !== 'no';
  const bill = gst ? inclusiveGst(billedGross(billing)) : { netPaise: billedGross(billing), gstPaise: 0 };
  const billSplit = equalShares(bill.netPaise, members.length);

  const receivedByMember = new Map<string, number>();
  const gstByReceiver = new Map<string, number>();
  let receivedNetPaise = 0;
  const edges: BalanceEdge[] = [];

  for (const payment of payments) {
    if (payment.voided === 'yes') continue;
    const gross = toPaise(payment.amount);
    const parts = gst ? inclusiveGst(gross) : { netPaise: gross, gstPaise: 0 };
    receivedNetPaise += parts.netPaise;
    if (payment.received_by && parts.gstPaise > 0) {
      gstByReceiver.set(
        payment.received_by,
        (gstByReceiver.get(payment.received_by) || 0) + parts.gstPaise,
      );
    }
    const split = equalShares(parts.netPaise, members.length);
    members.forEach((id, index) => {
      receivedByMember.set(id, (receivedByMember.get(id) || 0) + split[index]);
      pushEdge(edges, payment.received_by, id, split[index]);
    });
  }

  for (const settlement of settlements) {
    if (settlement.voided === 'yes') continue;
    // Money already handed over reduces what the sender owes the receiver.
    pushEdge(edges, settlement.to_contributor_id, settlement.from_contributor_id, toPaise(settlement.amount));
  }

  return {
    memberIds: members,
    gst,
    billNetPaise: bill.netPaise,
    billGstPaise: bill.gstPaise,
    billShares: lines(members, billSplit),
    receivedNetPaise,
    receivedShares: lines(
      members,
      members.map((id) => receivedByMember.get(id) || 0),
    ),
    gstHeld: [...gstByReceiver.entries()]
      .map(([contributorId, paise]) => ({ contributorId, paise }))
      .sort((a, b) => b.paise - a.paise),
    edges: netEdges(edges),
  };
}

function expenseEdges(expense: Expense, people: string[]): BalanceEdge[] {
  if (expense.active_code === 'inactive') return [];
  const members = [...new Set(people)].sort();
  const split = equalShares(toPaise(expense.amount), members.length);
  const edges: BalanceEdge[] = [];
  members.forEach((id, index) => {
    pushEdge(edges, id, expense.paid_by, split[index]);
  });
  return edges;
}


/** Company-wide who-owes-whom, across projects, expenses, and every transfer. */
export function companyBalances(data: AppData): BalanceEdge[] {
  const edges: BalanceEdge[] = [];
  for (const project of data.projects) {
    if (project.active_code === 'inactive') continue;
    const billing = data.project_billing.find((row) => row.project_id === project.project_id);
    const shares = projectShares(
      billing,
      data.project_payments.filter((row) => row.project_id === project.project_id),
      linkedIds(data.project_contributors, 'project_id', project.project_id),
      data.settlements.filter(
        (row) => row.project_id === project.project_id && !row.expense_id,
      ),
    );
    edges.push(...shares.edges);
  }
  for (const expense of data.expenses) {
    edges.push(
      ...expenseEdges(
        expense,
        linkedIds(data.expense_contributors, 'expense_id', expense.expense_id),
      ),
    );
  }
  for (const settlement of data.settlements) {
    if (settlement.voided === 'yes') continue;
    if (settlement.project_id) continue;
    pushEdge(
      edges,
      settlement.to_contributor_id,
      settlement.from_contributor_id,
      toPaise(settlement.amount),
    );
  }
  return netEdges(edges);
}

export function shareOf(lines: ShareLine[], contributorId: string): number {
  return lines.find((line) => line.contributorId === contributorId)?.paise ?? 0;
}
