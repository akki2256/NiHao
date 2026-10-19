import {
  AppData,
  Contributor,
  Expense,
  Project,
  ProjectBilling,
  ProjectComment,
  ProjectContributor,
  ProjectPayment,
  ProjectStatus,
  Settlement,
  Task,
  TaskComment,
  TaskStatus,
} from '../types/models';
import { summarizeBilling } from './billing';
import { coerceAppData } from './coerce';
import { AppError } from './errors';
import {
  amount,
  oneOf,
  optionalDate,
  optionalEmail,
  optionalPhone,
  optionalText,
  requireText,
} from './validation';

/**
 * Pure record store. The demo backend and the tests run this directly.
 * apps-script/Code.gs mirrors the same rules on the Google Sheet — keep them together.
 */

const PROJECT_STATUSES = ['Potential', 'In Progress', 'On Hold', 'In Testing', 'Completed'] as const;
const TASK_STATUSES = ['Open', 'In Progress', 'Complete'] as const;
const FREQUENCIES = ['', 'Daily', 'Weekly', 'Monthly', 'Yearly'] as const;

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export interface Session {
  token_hash: string;
  contributor_id: string;
  expires_at: string;
}

export interface ServerState {
  data: AppData;
  sessions: Session[];
  idempotency: Record<string, unknown>;
}

export interface CryptoDeps {
  hash: (value: string) => Promise<string>;
  token: () => string;
  now: () => Date;
}

export function emptyState(): ServerState {
  return {
    data: {
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
    },
    sessions: [],
    idempotency: {},
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function iso(deps: CryptoDeps): string {
  return deps.now().toISOString();
}

function day(deps: CryptoDeps): string {
  return iso(deps).slice(0, 10);
}

function bump(version: number | undefined): number {
  const current = Number(version || 0);
  return current > 0 ? current + 1 : 1;
}

function assertVersion(current: number | undefined, expected: unknown): void {
  const cur = Number(current || 0);
  if (cur === 0) return;
  if (Number(expected ?? 0) !== cur) {
    throw new AppError(
      'CONFLICT',
      'Someone else changed this. It has been reloaded — review and try again.',
    );
  }
}

/** Legacy hashes are unsalted `sha256("calicon:" + password)`. New ones are `v2$salt$hash`. */
export async function passwordMatches(
  hash: CryptoDeps['hash'],
  stored: string,
  password: string,
): Promise<boolean> {
  if (stored.startsWith('v2$')) {
    const [, salt, digest] = stored.split('$');
    if (!salt || !digest) return false;
    return (await hash(`${salt}:${password}`)) === digest;
  }
  return (await hash(`calicon:${password}`)) === stored;
}

async function hashPassword(deps: CryptoDeps, password: string): Promise<string> {
  const salt = deps.token();
  const digest = await deps.hash(`${salt}:${password}`);
  return `v2$${salt}$${digest}`;
}

export function toPublicContributor(user: Contributor): Contributor {
  return {
    contributor_id: user.contributor_id,
    display_name: user.display_name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    active_code: user.active_code,
    updated_at: user.updated_at,
  };
}

/** What the app is allowed to cache. Strips secrets and repairs sheet quirks. */
export function publicData(data: AppData): AppData {
  const coerced = coerceAppData(data).data;
  return coerced;
}

async function requireUser(
  state: ServerState,
  token: unknown,
  deps: CryptoDeps,
): Promise<Contributor> {
  const raw = String(token || '');
  if (!raw) throw new AppError('AUTH_EXPIRED', 'Please sign in again.');
  const tokenHash = await deps.hash(raw);
  const session = state.sessions.find((s) => s.token_hash === tokenHash);
  if (!session || new Date(session.expires_at).getTime() <= deps.now().getTime()) {
    throw new AppError('AUTH_EXPIRED', 'Your session expired. Please sign in again.');
  }
  const user = state.data.contributors.find(
    (c) => c.contributor_id === session.contributor_id && c.active_code === 'active',
  );
  if (!user) throw new AppError('AUTH_EXPIRED', 'This account is no longer active.');
  return user;
}

function recomputeBilling(data: AppData, projectId: string): void {
  const billing = data.project_billing.find((b) => b.project_id === projectId);
  if (!billing) return;
  const summary = summarizeBilling(
    billing,
    data.project_payments.filter((p) => p.project_id === projectId),
  );
  billing.received_amount = summary.received;
  billing.pending_amount = summary.pending;
  billing.version = bump(billing.version);
}

function touchProject(data: AppData, projectId: string, actorId: string, deps: CryptoDeps): void {
  const project = data.projects.find((p) => p.project_id === projectId);
  if (!project) return;
  project.updated_at = iso(deps);
  project.last_updated_by = actorId;
  project.version = bump(project.version);
}

export async function reduce(
  state: ServerState,
  action: string,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<{ state: ServerState; result: unknown }> {
  const key = String(payload.idempotencyKey || '');
  if (key && Object.prototype.hasOwnProperty.call(state.idempotency, key)) {
    return { state, result: state.idempotency[key] };
  }
  const next = clone(state);
  const result = await dispatch(next, action, payload, deps);
  if (key) next.idempotency[key] = result;
  return { state: next, result };
}

async function dispatch(
  state: ServerState,
  action: string,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<unknown> {
  switch (action) {
    case 'login':
      return login(state, payload, deps);
    case 'bootstrap': {
      await requireUser(state, payload.token, deps);
      return publicData(state.data);
    }
    case 'saveProject':
      return saveProject(state, payload, deps);
    case 'saveTask':
      return saveTask(state, payload, deps);
    case 'saveExpense':
      return saveExpense(state, payload, deps);
    case 'saveBilling':
      return saveBilling(state, payload, deps);
    case 'addProjectComment':
      return addProjectComment(state, payload, deps);
    case 'addTaskComment':
      return addTaskComment(state, payload, deps);
    case 'addPayment':
      return addPayment(state, payload, deps);
    case 'voidPayment':
      return voidPayment(state, payload, deps);
    case 'setActive':
      return setActive(state, payload, deps);
    case 'updateContributorProfile':
      return updateProfile(state, payload, deps);
    case 'savePushToken':
      return savePushToken(state, payload, deps);
    case 'addSettlement':
      return addSettlement(state, payload, deps);
    case 'voidSettlement':
      return voidSettlement(state, payload, deps);
    default:
      throw new AppError('SERVER', `Unknown action: ${action}`);
  }
}

async function login(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<{ token: string; user: Contributor }> {
  const identifier = String(payload.identifier || '').trim().toLowerCase();
  const password = String(payload.password || '');
  if (!identifier || !password) {
    throw new AppError('VALIDATION', 'Enter your username and password.');
  }
  const user = state.data.contributors.find((c) => {
    return (
      c.active_code === 'active' &&
      (c.username.toLowerCase() === identifier ||
        c.email.toLowerCase() === identifier ||
        String(c.phone).trim() === identifier)
    );
  });
  if (!user || !(await passwordMatches(deps.hash, String(user.password_hash || ''), password))) {
    throw new AppError('AUTH_FAILED', 'Invalid login credentials.');
  }
  if (!String(user.password_hash || '').startsWith('v2$')) {
    user.password_hash = await hashPassword(deps, password);
    user.updated_at = iso(deps);
  }
  const token = deps.token();
  state.sessions.push({
    token_hash: await deps.hash(token),
    contributor_id: user.contributor_id,
    expires_at: new Date(deps.now().getTime() + SESSION_MS).toISOString(),
  });
  return { token, user: toPublicContributor(user) };
}

async function saveProject(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<Project> {
  const actor = await requireUser(state, payload.token, deps);
  const input = (payload.project || {}) as Partial<Project>;
  const clientName = requireText(input.client_name, 'Client name', 120);
  const existing = input.project_id
    ? state.data.projects.find((p) => p.project_id === input.project_id)
    : undefined;
  if (input.project_id && !existing && Number(payload.expectedVersion || 0) > 0) {
    throw new AppError('NOT_FOUND', 'That project no longer exists.');
  }
  assertVersion(existing?.version, payload.expectedVersion);
  const duplicate = state.data.projects.find(
    (p) =>
      p.active_code !== 'inactive' &&
      p.project_id !== existing?.project_id &&
      p.client_name.trim().toLowerCase() === clientName.toLowerCase(),
  );
  if (duplicate) {
    throw new AppError('DUPLICATE', `A project named "${duplicate.client_name}" already exists.`);
  }
  const status = oneOf<ProjectStatus>(input.status, 'Status', PROJECT_STATUSES, 'Potential');
  const row: Project = {
    project_id: existing?.project_id || String(input.project_id || deps.token()),
    client_name: clientName,
    project_type: optionalText(input.project_type, 'Project type', 80),
    status,
    phone: optionalPhone(input.phone),
    email: optionalEmail(input.email),
    address: optionalText(input.address, 'Address', 300),
    started_date: optionalDate(input.started_date || existing?.started_date || day(deps), 'Start date'),
    completed_date: optionalDate(
      status === 'Completed'
        ? input.completed_date || existing?.completed_date || day(deps)
        : input.completed_date || existing?.completed_date || '',
      'Completed date',
    ),
    updated_at: iso(deps),
    last_updated_by: actor.contributor_id,
    active_code: existing?.active_code === 'inactive' ? 'inactive' : 'active',
    version: bump(existing?.version),
  };
  if (existing) Object.assign(existing, row);
  else state.data.projects.push(row);

  if (Array.isArray(payload.contributorIds)) {
    syncPeople(state, 'project', row.project_id, payload.contributorIds, deps);
  }
  if (payload.gstIncluded === 'yes' || payload.gstIncluded === 'no') {
    setProjectGst(state, row.project_id, payload.gstIncluded, deps);
  }

  if (!existing && !state.data.project_billing.some((b) => b.project_id === row.project_id)) {
    const billing: ProjectBilling = {
      billing_id: deps.token(),
      project_id: row.project_id,
      quoted_amount: 0,
      final_amount: 0,
      received_amount: 0,
      pending_amount: 0,
      gst_included: payload.gstIncluded === 'no' ? 'no' : 'yes',
      version: 1,
    };
    state.data.project_billing.push(billing);
  }
  return row;
}

async function saveTask(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<Task> {
  const actor = await requireUser(state, payload.token, deps);
  const input = (payload.task || {}) as Partial<Task>;
  const name = requireText(input.task_name, 'Task name', 140);
  const existing = input.task_id
    ? state.data.tasks.find((t) => t.task_id === input.task_id)
    : undefined;
  if (input.task_id && !existing && Number(payload.expectedVersion || 0) > 0) {
    throw new AppError('NOT_FOUND', 'That task no longer exists.');
  }
  assertVersion(existing?.version, payload.expectedVersion);
  const duplicate = state.data.tasks.find(
    (t) =>
      t.active_status !== 'inactive' &&
      t.task_id !== existing?.task_id &&
      t.task_name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) throw new AppError('DUPLICATE', `A task named "${duplicate.task_name}" already exists.`);
  const row: Task = {
    task_id: existing?.task_id || deps.token(),
    task_name: name,
    task_description: optionalText(input.task_description, 'Description', 2000),
    status: oneOf<TaskStatus>(input.status, 'Status', TASK_STATUSES, 'Open'),
    created_by: existing?.created_by || actor.contributor_id,
    created_date: existing?.created_date || iso(deps),
    active_status: existing?.active_status === 'inactive' ? 'inactive' : 'active',
    updated_at: iso(deps),
    version: bump(existing?.version),
  };
  if (existing) Object.assign(existing, row);
  else state.data.tasks.push(row);
  return row;
}

async function saveExpense(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<Expense> {
  const actor = await requireUser(state, payload.token, deps);
  const input = (payload.expense || {}) as Partial<Expense>;
  const title = requireText(input.title, 'Title', 140);
  const value = amount(input.amount, 'Amount', 0);
  const expenseDate = optionalDate(input.expense_date || day(deps), 'Expense date');
  const existing = input.expense_id
    ? state.data.expenses.find((e) => e.expense_id === input.expense_id)
    : undefined;
  if (input.expense_id && !existing && Number(payload.expectedVersion || 0) > 0) {
    throw new AppError('NOT_FOUND', 'That expense no longer exists.');
  }
  assertVersion(existing?.version, payload.expectedVersion);
  const duplicate = state.data.expenses.find(
    (e) =>
      !existing &&
      e.active_code !== 'inactive' &&
      e.title.trim().toLowerCase() === title.toLowerCase() &&
      e.expense_date === expenseDate &&
      Number(e.amount) === value,
  );
  if (duplicate) {
    throw new AppError('DUPLICATE', 'An expense with the same title, date and amount already exists.');
  }
  const recurring = input.recurring_status === 'yes' ? 'yes' : 'no';
  const row: Expense = {
    expense_id: existing?.expense_id || deps.token(),
    title,
    notes: optionalText(input.notes, 'Notes', 2000),
    amount: value,
    paid_by: existing?.paid_by || actor.contributor_id,
    expense_date: expenseDate,
    recurring_status: recurring,
    frequency: recurring === 'yes' ? oneOf(input.frequency, 'Frequency', FREQUENCIES, 'Monthly') : '',
    active_code: existing?.active_code === 'inactive' ? 'inactive' : 'active',
    updated_at: iso(deps),
    version: bump(existing?.version),
  };
  if (existing) Object.assign(existing, row);
  else state.data.expenses.push(row);
  if (Array.isArray(payload.contributorIds)) {
    syncPeople(state, 'expense', row.expense_id, payload.contributorIds, deps);
  }
  return row;
}

async function saveBilling(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<ProjectBilling> {
  const actor = await requireUser(state, payload.token, deps);
  const input = (payload.billing || {}) as Partial<ProjectBilling>;
  const billing = state.data.project_billing.find((b) => b.billing_id === input.billing_id);
  if (!billing) throw new AppError('NOT_FOUND', 'Billing record not found.');
  assertVersion(billing.version, payload.expectedVersion);
  billing.quoted_amount = amount(input.quoted_amount, 'Quoted amount', 0, billing.quoted_amount);
  billing.final_amount = amount(input.final_amount, 'Final amount', 0, billing.final_amount);
  billing.gst_included = input.gst_included === 'no' ? 'no' : 'yes';
  recomputeBilling(state.data, billing.project_id);
  touchProject(state.data, billing.project_id, actor.contributor_id, deps);
  return billing;
}

async function addProjectComment(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<ProjectComment> {
  const actor = await requireUser(state, payload.token, deps);
  const projectId = String(payload.projectId || '');
  const project = state.data.projects.find((p) => p.project_id === projectId);
  if (!project || project.active_code === 'inactive') {
    throw new AppError('NOT_FOUND', 'That project no longer exists.');
  }
  const row: ProjectComment = {
    comment_id: deps.token(),
    project_id: projectId,
    comment: requireText(payload.comment, 'Comment', 2000),
    added_by: actor.contributor_id,
    added_date: iso(deps),
    active_code: 'active',
  };
  state.data.project_comments.push(row);
  touchProject(state.data, projectId, actor.contributor_id, deps);
  return row;
}

async function addTaskComment(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<TaskComment> {
  const actor = await requireUser(state, payload.token, deps);
  const taskId = String(payload.taskId || '');
  const task = state.data.tasks.find((t) => t.task_id === taskId && t.active_status !== 'inactive');
  if (!task) throw new AppError('NOT_FOUND', 'That task no longer exists.');
  const row: TaskComment = {
    comment_id: deps.token(),
    task_id: taskId,
    comment: requireText(payload.comment, 'Comment', 2000),
    added_by: actor.contributor_id,
    added_date: iso(deps),
    active_code: 'active',
  };
  state.data.task_comments.push(row);
  task.updated_at = iso(deps);
  task.version = bump(task.version);
  return row;
}

async function addPayment(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<ProjectPayment> {
  const actor = await requireUser(state, payload.token, deps);
  const projectId = String(payload.projectId || '');
  const project = state.data.projects.find((p) => p.project_id === projectId && p.active_code !== 'inactive');
  if (!project) throw new AppError('NOT_FOUND', 'That project no longer exists.');
  const row: ProjectPayment = {
    payment_id: deps.token(),
    project_id: projectId,
    amount: amount(payload.amount, 'Amount', 0.01),
    date: optionalDate(payload.date || day(deps), 'Payment date'),
    received_by: actor.contributor_id,
    voided: 'no',
    void_reason: '',
    voided_by: '',
    voided_at: '',
  };
  state.data.project_payments.push(row);
  recomputeBilling(state.data, projectId);
  touchProject(state.data, projectId, actor.contributor_id, deps);
  return row;
}

async function voidPayment(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<ProjectPayment> {
  const actor = await requireUser(state, payload.token, deps);
  const payment = state.data.project_payments.find((p) => p.payment_id === payload.paymentId);
  if (!payment) throw new AppError('NOT_FOUND', 'That payment no longer exists.');
  if (payment.voided === 'yes') return payment;
  const reason = requireText(payload.reason, 'Reason', 300);
  payment.voided = 'yes';
  payment.void_reason = reason;
  payment.voided_by = actor.contributor_id;
  payment.voided_at = iso(deps);
  recomputeBilling(state.data, payment.project_id);
  touchProject(state.data, payment.project_id, actor.contributor_id, deps);
  return payment;
}

async function setActive(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<{ id: string; active: boolean }> {
  const actor = await requireUser(state, payload.token, deps);
  const id = String(payload.id || '');
  const active = payload.active !== false && payload.active !== 'inactive';
  const sheet = String(payload.sheet || '');
  const flag = active ? 'active' : 'inactive';

  if (sheet === 'projects') {
    const row = state.data.projects.find((p) => p.project_id === id);
    if (!row) throw new AppError('NOT_FOUND', 'That project no longer exists.');
    assertVersion(row.version, payload.expectedVersion);
    row.active_code = flag;
    row.updated_at = iso(deps);
    row.last_updated_by = actor.contributor_id;
    row.version = bump(row.version);
    return { id, active };
  }
  if (sheet === 'tasks') {
    const row = state.data.tasks.find((t) => t.task_id === id);
    if (!row) throw new AppError('NOT_FOUND', 'That task no longer exists.');
    assertVersion(row.version, payload.expectedVersion);
    row.active_status = flag;
    row.updated_at = iso(deps);
    row.version = bump(row.version);
    return { id, active };
  }
  if (sheet === 'expenses') {
    const row = state.data.expenses.find((e) => e.expense_id === id);
    if (!row) throw new AppError('NOT_FOUND', 'That expense no longer exists.');
    assertVersion(row.version, payload.expectedVersion);
    row.active_code = flag;
    row.updated_at = iso(deps);
    row.version = bump(row.version);
    return { id, active };
  }
  throw new AppError('VALIDATION', 'That record cannot be deleted.');
}

async function updateProfile(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<Contributor> {
  const actor = await requireUser(state, payload.token, deps);
  const fields = (payload.fields || {}) as Record<string, unknown>;
  actor.display_name = requireText(fields.display_name ?? actor.display_name, 'Display name', 80);
  actor.email = optionalEmail(fields.email ?? actor.email);
  actor.phone = optionalPhone(fields.phone ?? actor.phone);
  const nextPassword = String(payload.newPassword || '');
  if (nextPassword) {
    if (nextPassword.length < 8) {
      throw new AppError('VALIDATION', 'Password must be at least 8 characters.');
    }
    actor.password_hash = await hashPassword(deps, nextPassword);
  }
  actor.updated_at = iso(deps);
  return toPublicContributor(actor);
}

async function savePushToken(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<{ ok: true }> {
  const actor = await requireUser(state, payload.token, deps);
  const token = String(payload.push_token || '');
  if (token && !token.startsWith('ExponentPushToken')) {
    throw new AppError('VALIDATION', 'Unrecognised push token.');
  }
  actor.push_token = token;
  actor.updated_at = iso(deps);
  return { ok: true };
}

function chosenIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))];
}

function syncPeople(
  state: ServerState,
  kind: 'project' | 'expense',
  parentId: string,
  rawIds: unknown,
  deps: CryptoDeps,
): void {
  const ids = chosenIds(rawIds);
  if (!ids.length) throw new AppError('VALIDATION', 'Choose at least one person.');
  for (const id of ids) {
    const person = state.data.contributors.find(
      (c) => c.contributor_id === id && c.active_code === 'active',
    );
    if (!person) throw new AppError('VALIDATION', 'Choose people from the team.');
  }
  const wanted = new Set(ids);
  if (kind === 'project') {
    for (const row of state.data.project_contributors.filter((r) => r.project_id === parentId)) {
      row.active_status = wanted.has(row.contributor_id) ? 'active' : 'inactive';
      wanted.delete(row.contributor_id);
    }
    for (const contributor_id of wanted) {
      const row: ProjectContributor = {
        id: deps.token(),
        project_id: parentId,
        contributor_id,
        active_status: 'active',
      };
      state.data.project_contributors.push(row);
    }
    return;
  }
  for (const row of state.data.expense_contributors.filter((r) => r.expense_id === parentId)) {
    row.active_status = wanted.has(row.contributor_id) ? 'active' : 'inactive';
    wanted.delete(row.contributor_id);
  }
  for (const contributor_id of wanted) {
    state.data.expense_contributors.push({
      id: deps.token(),
      expense_id: parentId,
      contributor_id,
      active_status: 'active',
    });
  }
}

function setProjectGst(
  state: ServerState,
  projectId: string,
  gst: 'yes' | 'no',
  deps: CryptoDeps,
): void {
  const billing = state.data.project_billing.find((row) => row.project_id === projectId);
  if (!billing) {
    state.data.project_billing.push({
      billing_id: deps.token(),
      project_id: projectId,
      quoted_amount: 0,
      final_amount: 0,
      received_amount: 0,
      pending_amount: 0,
      gst_included: gst,
      version: 1,
    });
    return;
  }
  billing.gst_included = gst;
  billing.version = bump(billing.version);
}

async function addSettlement(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<Settlement> {
  const actor = await requireUser(state, payload.token, deps);
  const fromId = String(payload.fromId || '');
  const toId = String(payload.toId || '');
  if (!fromId || !toId || fromId === toId) {
    throw new AppError('VALIDATION', 'Choose two different people.');
  }
  const active = new Set(
    state.data.contributors.filter((c) => c.active_code === 'active').map((c) => c.contributor_id),
  );
  if (!active.has(fromId) || !active.has(toId)) {
    throw new AppError('VALIDATION', 'Choose people from the team.');
  }
  const projectId = String(payload.projectId || '');
  const expenseId = String(payload.expenseId || '');
  if (projectId && expenseId) {
    throw new AppError('VALIDATION', 'Link a project or an expense, not both.');
  }
  if (
    projectId &&
    !state.data.projects.some((p) => p.project_id === projectId && p.active_code !== 'inactive')
  ) {
    throw new AppError('NOT_FOUND', 'That project no longer exists.');
  }
  if (
    expenseId &&
    !state.data.expenses.some((e) => e.expense_id === expenseId && e.active_code !== 'inactive')
  ) {
    throw new AppError('NOT_FOUND', 'That expense no longer exists.');
  }
  const row: Settlement = {
    settlement_id: deps.token(),
    from_contributor_id: fromId,
    to_contributor_id: toId,
    amount: amount(payload.amount, 'Amount', 0.01),
    date: optionalDate(payload.date || day(deps), 'Date'),
    project_id: projectId,
    expense_id: expenseId,
    note: optionalText(payload.note, 'Note', 300),
    created_by: actor.contributor_id,
    created_at: iso(deps),
    voided: 'no',
    void_reason: '',
  };
  state.data.settlements.push(row);
  return row;
}

async function voidSettlement(
  state: ServerState,
  payload: Record<string, unknown>,
  deps: CryptoDeps,
): Promise<Settlement> {
  await requireUser(state, payload.token, deps);
  const row = state.data.settlements.find((s) => s.settlement_id === payload.settlementId);
  if (!row) throw new AppError('NOT_FOUND', 'That transfer no longer exists.');
  if (row.voided === 'yes') return row;
  row.voided = 'yes';
  row.void_reason = requireText(payload.reason, 'Reason', 300);
  return row;
}
