import * as Crypto from 'expo-crypto';
import { API_URL, USE_MOCK } from '../config/env';
import { AppError } from '../domain/errors';
import { CryptoDeps, reduce } from '../domain/store';
import {
  AppData,
  Contributor,
  Expense,
  Project,
  ProjectBilling,
  ProjectPayment,
  Settlement,
  Task,
} from '../types/models';
import { createId } from '../utils/id';
import { getMockState, setMockState } from './mockStore';
import { postJson } from './transport';

/**
 * Data access. Demo mode runs the same rules as the sheet (src/domain/store.ts).
 * Production posts to the Apps Script web app, which enforces them again.
 */

let authToken = '';

const deps: CryptoDeps = {
  hash: (value) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
  token: () => createId('id'),
  now: () => new Date(),
};

export function setApiToken(token: string): void {
  authToken = token;
}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const body = { action, token: authToken, ...payload };
  if (USE_MOCK) {
    const out = await reduce(getMockState(), action, body, deps);
    setMockState(out.state);
    return out.result as T;
  }
  return (await postJson(API_URL, body)) as T;
}

async function callRead<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  try {
    return await call<T>(action, payload);
  } catch (error) {
    if (error instanceof AppError && (error.code === 'NETWORK' || error.code === 'TIMEOUT')) {
      return call<T>(action, payload);
    }
    throw error;
  }
}

export const api = {
  setToken: setApiToken,
  login: (identifier: string, password: string) =>
    call<{ token: string; user: Contributor }>('login', { identifier, password }),
  bootstrap: () => callRead<AppData>('bootstrap'),
  saveProject: (
    project: Partial<Project>,
    expectedVersion: number,
    idempotencyKey: string,
    contributorIds?: string[],
    gstIncluded?: 'yes' | 'no',
  ) =>
    call<Project>('saveProject', {
      project,
      expectedVersion,
      idempotencyKey,
      contributorIds,
      gstIncluded,
    }),
  saveTask: (task: Partial<Task>, expectedVersion: number, idempotencyKey: string) =>
    call<Task>('saveTask', { task, expectedVersion, idempotencyKey }),
  saveExpense: (
    expense: Partial<Expense>,
    expectedVersion: number,
    idempotencyKey: string,
    contributorIds?: string[],
  ) => call<Expense>('saveExpense', { expense, expectedVersion, idempotencyKey, contributorIds }),
  saveBilling: (
    billing: ProjectBilling,
    expectedVersion: number,
    idempotencyKey: string,
  ) => call<ProjectBilling>('saveBilling', { billing, expectedVersion, idempotencyKey }),
  addProjectComment: (projectId: string, comment: string, idempotencyKey: string) =>
    call('addProjectComment', { projectId, comment, idempotencyKey }),
  addTaskComment: (taskId: string, comment: string, idempotencyKey: string) =>
    call('addTaskComment', { taskId, comment, idempotencyKey }),
  addPayment: (projectId: string, amount: number, idempotencyKey: string) =>
    call<ProjectPayment>('addPayment', { projectId, amount, idempotencyKey }),
  voidPayment: (paymentId: string, reason: string, idempotencyKey: string) =>
    call('voidPayment', { paymentId, reason, idempotencyKey }),
  setActive: (
    sheet: 'projects' | 'tasks' | 'expenses',
    id: string,
    active: boolean,
    expectedVersion: number,
    idempotencyKey: string,
  ) => call('setActive', { sheet, id, active, expectedVersion, idempotencyKey }),
  updateContributorProfile: (
    fields: { display_name: string; email: string; phone: string },
    newPassword: string,
  ) => call<Contributor>('updateContributorProfile', { fields, newPassword }),
  savePushToken: (push_token: string) => call('savePushToken', { push_token }),
  addSettlement: (input: {
    fromId: string;
    toId: string;
    amount: number;
    date: string;
    projectId: string;
    expenseId: string;
    note: string;
    idempotencyKey: string;
  }) => call<Settlement>('addSettlement', input),
  voidSettlement: (settlementId: string, reason: string, idempotencyKey: string) =>
    call<Settlement>('voidSettlement', { settlementId, reason, idempotencyKey }),
};
