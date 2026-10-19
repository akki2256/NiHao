import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { coerceAppData } from '../domain/coerce';
import { SyncStatus } from '../domain/sync';
import { isAppError } from '../domain/errors';
import { api } from '../services/api';
import { loadCache, saveCache } from '../services/cache';
import {
  AppData,
  Expense,
  Project,
  ProjectBilling,
  Task,
} from '../types/models';
import { createId } from '../utils/id';
import { useAuth } from './AuthContext';

const emptyData = (): AppData => ({
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

type ActiveSheet = 'projects' | 'tasks' | 'expenses';

type DataContextValue = {
  data: AppData;
  loading: boolean;
  offline: boolean;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  refresh: () => Promise<void>;
  saveProject: (
    project: Partial<Project> & {
      client_name: string;
      contributorIds?: string[];
      gstIncluded?: 'yes' | 'no';
    },
  ) => Promise<void>;
  saveTask: (task: Partial<Task> & { task_name: string }) => Promise<void>;
  saveExpense: (
    expense: Partial<Expense> & { title: string; amount: number; contributorIds?: string[] },
  ) => Promise<void>;
  addProjectComment: (projectId: string, comment: string) => Promise<void>;
  addTaskComment: (taskId: string, comment: string) => Promise<void>;
  addPayment: (projectId: string, amount: number) => Promise<void>;
  voidPayment: (paymentId: string, reason: string) => Promise<void>;
  saveBilling: (billing: ProjectBilling) => Promise<void>;
  setActive: (
    sheet: ActiveSheet,
    id: string,
    active: boolean,
    expectedVersion: number,
  ) => Promise<void>;
  addSettlement: (input: {
    fromId: string;
    toId: string;
    amount: number;
    date: string;
    projectId: string;
    expenseId: string;
    note: string;
  }) => Promise<void>;
  voidSettlement: (settlementId: string, reason: string) => Promise<void>;
};

const EMPTY_DATA = emptyData();
const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [data, setData] = useState<AppData>(emptyData());
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());
  const userId = user?.contributor_id ?? null;
  const loading = userId !== null && readyFor !== userId;

  const keyFor = (slot: string) => {
    const existing = keys.current.get(slot);
    if (existing) return existing;
    const created = createId('idem');
    keys.current.set(slot, created);
    return created;
  };
  const done = (slot: string) => keys.current.delete(slot);

  const applyRemote = useCallback(async (remote: unknown) => {
    const coerced = coerceAppData(remote);
    setData(coerced.data);
    setOffline(false);
    setSyncStatus('synced');
    setSyncMessage(
      coerced.warnings.length
        ? `${coerced.warnings.length} rows looked wrong and were skipped.`
        : null,
    );
    await saveCache(coerced.data);
  }, []);

  const applyFailure = useCallback(
    async (error: unknown) => {
      if (isAppError(error) && error.code === 'AUTH_EXPIRED') {
        await logout();
        return;
      }
      const cached = await loadCache();
      if (cached) {
        setData(cached);
        setOffline(true);
        setSyncStatus('offline');
        setSyncMessage('Showing the last saved copy. Changes are paused.');
      } else {
        setSyncStatus('error');
        setSyncMessage(error instanceof Error ? error.message : 'Unable to load data.');
      }
    },
    [logout],
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    setSyncStatus('syncing');
    try {
      await applyRemote(await api.bootstrap());
    } catch (error) {
      await applyFailure(error);
    } finally {
      setReadyFor(userId);
    }
  }, [applyFailure, applyRemote, userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // State updates live in the promise callbacks, which is when the response arrives.
    api
      .bootstrap()
      .then((remote) => {
        if (!cancelled) return applyRemote(remote);
      })
      .catch((error: unknown) => {
        if (!cancelled) return applyFailure(error);
      })
      .finally(() => {
        if (!cancelled) setReadyFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [applyFailure, applyRemote, userId]);

  const runWrite = useCallback(
    async (slot: string, write: (idempotencyKey: string) => Promise<unknown>) => {
      const idempotencyKey = keyFor(slot);
      setSyncStatus('syncing');
      try {
        await write(idempotencyKey);
        await refresh();
        done(slot);
      } catch (error) {
        if (isAppError(error) && error.code === 'AUTH_EXPIRED') {
          await logout();
        } else if (isAppError(error) && error.code === 'CONFLICT') {
          await refresh();
        } else {
          setSyncStatus('error');
          setSyncMessage(error instanceof Error ? error.message : 'Save failed.');
        }
        throw error;
      }
    },
    [logout, refresh],
  );

  const saveProject = useCallback(
    async (
      project: Partial<Project> & {
        client_name: string;
        contributorIds?: string[];
        gstIncluded?: 'yes' | 'no';
      },
    ) => {
      const slot = project.project_id || `new-project:${project.client_name.trim().toLowerCase()}`;
      await runWrite(slot, (idempotencyKey) =>
        api.saveProject(
          project,
          Number(project.version || 0),
          idempotencyKey,
          project.contributorIds,
          project.gstIncluded,
        ),
      );
    },
    [runWrite],
  );

  const saveTask = useCallback(
    async (task: Partial<Task> & { task_name: string }) => {
      const slot = task.task_id || `new-task:${task.task_name.trim().toLowerCase()}`;
      await runWrite(slot, (idempotencyKey) =>
        api.saveTask(task, Number(task.version || 0), idempotencyKey),
      );
    },
    [runWrite],
  );

  const saveExpense = useCallback(
    async (expense: Partial<Expense> & { title: string; amount: number; contributorIds?: string[] }) => {
      const slot =
        expense.expense_id ||
        `new-expense:${expense.title.trim().toLowerCase()}:${expense.expense_date}:${expense.amount}`;
      await runWrite(slot, (idempotencyKey) =>
        api.saveExpense(
          expense,
          Number(expense.version || 0),
          idempotencyKey,
          expense.contributorIds,
        ),
      );
    },
    [runWrite],
  );

  const saveBilling = useCallback(
    async (billing: ProjectBilling) => {
      await runWrite(`billing:${billing.billing_id}`, (idempotencyKey) =>
        api.saveBilling(billing, Number(billing.version || 0), idempotencyKey),
      );
    },
    [runWrite],
  );

  const addProjectComment = useCallback(
    async (projectId: string, comment: string) => {
      await runWrite(`comment:${projectId}:${comment}`, (idempotencyKey) =>
        api.addProjectComment(projectId, comment, idempotencyKey),
      );
    },
    [runWrite],
  );

  const addTaskComment = useCallback(
    async (taskId: string, comment: string) => {
      await runWrite(`task-comment:${taskId}:${comment}`, (idempotencyKey) =>
        api.addTaskComment(taskId, comment, idempotencyKey),
      );
    },
    [runWrite],
  );

  const addPayment = useCallback(
    async (projectId: string, value: number) => {
      await runWrite(`payment:${projectId}`, (idempotencyKey) =>
        api.addPayment(projectId, value, idempotencyKey),
      );
    },
    [runWrite],
  );

  const voidPayment = useCallback(
    async (paymentId: string, reason: string) => {
      await runWrite(`void:${paymentId}`, (idempotencyKey) =>
        api.voidPayment(paymentId, reason, idempotencyKey),
      );
    },
    [runWrite],
  );

  const addSettlement = useCallback(
    async (input: {
      fromId: string;
      toId: string;
      amount: number;
      date: string;
      projectId: string;
      expenseId: string;
      note: string;
    }) => {
      const slot = `settle:${input.fromId}:${input.toId}:${input.projectId}:${input.expenseId}:${input.amount}`;
      await runWrite(slot, (idempotencyKey) => api.addSettlement({ ...input, idempotencyKey }));
    },
    [runWrite],
  );

  const voidSettlement = useCallback(
    async (settlementId: string, reason: string) => {
      await runWrite(`void-settle:${settlementId}`, (idempotencyKey) =>
        api.voidSettlement(settlementId, reason, idempotencyKey),
      );
    },
    [runWrite],
  );

  const setActive = useCallback(
    async (sheet: ActiveSheet, id: string, active: boolean, expectedVersion: number) => {
      await runWrite(`${sheet}:${id}:${active}`, (idempotencyKey) =>
        api.setActive(sheet, id, active, expectedVersion, idempotencyKey),
      );
    },
    [runWrite],
  );

  const visible = userId ? data : EMPTY_DATA;

  const value = useMemo(
    () => ({
      data: visible,
      loading,
      offline,
      syncStatus,
      syncMessage,
      refresh,
      saveProject,
      saveTask,
      saveExpense,
      addProjectComment,
      addTaskComment,
      addPayment,
      voidPayment,
      saveBilling,
      setActive,
      addSettlement,
      voidSettlement,
    }),
    [
      visible,
      loading,
      offline,
      syncStatus,
      syncMessage,
      refresh,
      saveProject,
      saveTask,
      saveExpense,
      addProjectComment,
      addTaskComment,
      addPayment,
      voidPayment,
      saveBilling,
      setActive,
      addSettlement,
      voidSettlement,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
