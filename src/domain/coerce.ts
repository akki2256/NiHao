import { AppError } from './errors';
import { AppData } from '../types/models';

export interface CoerceResult {
  data: AppData;
  /** Human-readable notes about rows that were skipped or repaired. */
  warnings: string[];
}

const empty = (): AppData => ({
  contributors: [],
  projects: [],
  project_comments: [],
  project_payments: [],
  project_billing: [],
  project_contributors: [],
  expenses: [],
  expense_contributors: [],
  tasks: [],
  task_comments: [],
  settlements: [],
});

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value).trim();
}

function asAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Sheets sometimes returns full timestamps for a date column. Keep calendar dates. */
function asDate(value: unknown): string {
  const text = asString(value);
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return iso ? iso[1] : text;
}

function rows(raw: unknown, name: string, warnings: string[]): Record<string, unknown>[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    warnings.push(`${name} was not a list and was ignored.`);
    return [];
  }
  return raw.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
}

function keep(
  row: Record<string, unknown>,
  idKey: string,
  sheet: string,
  warnings: string[],
): boolean {
  if (!asString(row[idKey])) {
    warnings.push(`A ${sheet} row had no ${idKey} and was skipped.`);
    return false;
  }
  return true;
}

/**
 * Turns a bootstrap payload (which may contain sheet quirks: numbers for
 * phones, timestamps for dates, missing tabs, junk rows) into AppData.
 * Rows without an id are dropped. Secrets are removed.
 */
export function coerceAppData(raw: unknown): CoerceResult {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError('MALFORMED', 'Server data was not in the expected format.');
  }
  const src = raw as Record<string, unknown>;
  const data = empty();

  data.contributors = rows(src.contributors, 'contributors', warnings)
    .filter((row) => keep(row, 'contributor_id', 'contributors', warnings))
    .map((row) => ({
      contributor_id: asString(row.contributor_id),
      display_name: asString(row.display_name),
      username: asString(row.username),
      email: asString(row.email),
      phone: asString(row.phone),
      active_code: asString(row.active_code) === 'inactive' ? 'inactive' : 'active',
      updated_at: asString(row.updated_at),
    }));

  data.projects = rows(src.projects, 'projects', warnings)
    .filter((row) => keep(row, 'project_id', 'projects', warnings))
    .map((row) => ({
      project_id: asString(row.project_id),
      client_name: asString(row.client_name) || 'Untitled',
      project_type: asString(row.project_type),
      status: (asString(row.status) || 'Potential') as AppData['projects'][number]['status'],
      phone: asString(row.phone),
      email: asString(row.email),
      address: asString(row.address),
      started_date: asDate(row.started_date),
      completed_date: asDate(row.completed_date),
      updated_at: asString(row.updated_at),
      last_updated_by: asString(row.last_updated_by),
      active_code: asString(row.active_code) === 'inactive' ? 'inactive' : 'active',
      version: asAmount(row.version),
    }));

  data.project_billing = rows(src.project_billing, 'project_billing', warnings)
    .filter((row) => keep(row, 'billing_id', 'project_billing', warnings))
    .map((row) => ({
      billing_id: asString(row.billing_id),
      project_id: asString(row.project_id),
      quoted_amount: asAmount(row.quoted_amount),
      final_amount: asAmount(row.final_amount),
      received_amount: asAmount(row.received_amount),
      pending_amount: asAmount(row.pending_amount),
      gst_included: asString(row.gst_included) === 'no' ? 'no' : 'yes',
      version: asAmount(row.version),
    }));

  data.project_payments = rows(src.project_payments, 'project_payments', warnings)
    .filter((row) => keep(row, 'payment_id', 'project_payments', warnings))
    .map((row) => ({
      payment_id: asString(row.payment_id),
      project_id: asString(row.project_id),
      amount: asAmount(row.amount),
      date: asDate(row.date),
      received_by: asString(row.received_by),
      voided: asString(row.voided) === 'yes' ? 'yes' : 'no',
      void_reason: asString(row.void_reason),
      voided_by: asString(row.voided_by),
      voided_at: asString(row.voided_at),
    }));

  data.project_comments = rows(src.project_comments, 'project_comments', warnings)
    .filter((row) => keep(row, 'comment_id', 'project_comments', warnings))
    .map((row) => ({
      comment_id: asString(row.comment_id),
      project_id: asString(row.project_id),
      comment: asString(row.comment),
      added_by: asString(row.added_by),
      added_date: asString(row.added_date),
      active_code: asString(row.active_code) === 'inactive' ? 'inactive' : 'active',
    }));

  data.project_contributors = rows(src.project_contributors, 'project_contributors', warnings)
    .filter((row) => keep(row, 'id', 'project_contributors', warnings))
    .map((row) => ({
      id: asString(row.id),
      project_id: asString(row.project_id),
      contributor_id: asString(row.contributor_id),
      active_status: asString(row.active_status) === 'inactive' ? 'inactive' : 'active',
    }));

  data.expenses = rows(src.expenses, 'expenses', warnings)
    .filter((row) => keep(row, 'expense_id', 'expenses', warnings))
    .map((row) => ({
      expense_id: asString(row.expense_id),
      title: asString(row.title) || 'Untitled',
      notes: asString(row.notes),
      amount: asAmount(row.amount),
      paid_by: asString(row.paid_by),
      expense_date: asDate(row.expense_date),
      recurring_status: asString(row.recurring_status) === 'yes' ? 'yes' : 'no',
      frequency: asString(row.frequency) as AppData['expenses'][number]['frequency'],
      active_code: asString(row.active_code) === 'inactive' ? 'inactive' : 'active',
      updated_at: asString(row.updated_at),
      version: asAmount(row.version),
    }));

  data.expense_contributors = rows(src.expense_contributors, 'expense_contributors', warnings)
    .filter((row) => keep(row, 'id', 'expense_contributors', warnings))
    .map((row) => ({
      id: asString(row.id),
      expense_id: asString(row.expense_id),
      contributor_id: asString(row.contributor_id),
      active_status: asString(row.active_status) === 'inactive' ? 'inactive' : 'active',
    }));

  data.tasks = rows(src.tasks, 'tasks', warnings)
    .filter((row) => keep(row, 'task_id', 'tasks', warnings))
    .map((row) => ({
      task_id: asString(row.task_id),
      task_name: asString(row.task_name) || 'Untitled',
      task_description: asString(row.task_description),
      status: (asString(row.status) || 'Open') as AppData['tasks'][number]['status'],
      created_by: asString(row.created_by),
      created_date: asString(row.created_date),
      active_status: asString(row.active_status) === 'inactive' ? 'inactive' : 'active',
      updated_at: asString(row.updated_at),
      version: asAmount(row.version),
    }));

  data.settlements = rows(src.settlements, 'settlements', warnings)
    .filter((row) => keep(row, 'settlement_id', 'settlements', warnings))
    .map((row) => ({
      settlement_id: asString(row.settlement_id),
      from_contributor_id: asString(row.from_contributor_id),
      to_contributor_id: asString(row.to_contributor_id),
      amount: asAmount(row.amount),
      date: asDate(row.date),
      project_id: asString(row.project_id),
      expense_id: asString(row.expense_id),
      note: asString(row.note),
      created_by: asString(row.created_by),
      created_at: asString(row.created_at),
      voided: asString(row.voided) === 'yes' ? 'yes' : 'no',
      void_reason: asString(row.void_reason),
    }));

  data.task_comments = rows(src.task_comments, 'task_comments', warnings)
    .filter((row) => keep(row, 'comment_id', 'task_comments', warnings))
    .map((row) => ({
      comment_id: asString(row.comment_id),
      task_id: asString(row.task_id),
      comment: asString(row.comment),
      added_by: asString(row.added_by),
      added_date: asString(row.added_date),
      active_code: asString(row.active_code) === 'inactive' ? 'inactive' : 'active',
    }));

  return { data, warnings };
}
