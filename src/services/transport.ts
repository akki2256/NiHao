import { AppError, ErrorCode } from '../domain/errors';

const CODES: ErrorCode[] = [
  'AUTH_FAILED',
  'AUTH_EXPIRED',
  'CONFLICT',
  'VALIDATION',
  'NOT_FOUND',
  'DUPLICATE',
  'NETWORK',
  'TIMEOUT',
  'MALFORMED',
  'SERVER',
];

function asCode(value: unknown): ErrorCode {
  return CODES.includes(value as ErrorCode) ? (value as ErrorCode) : 'SERVER';
}

/** Interprets the JSON envelope `{ ok, data, error, code }` from Apps Script. */
export function parseApiText(text: string): unknown {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AppError(
      'MALFORMED',
      'The server returned something that was not data. Check the Web App URL.',
    );
  }
  if (!json || typeof json !== 'object') {
    throw new AppError('MALFORMED', 'The server returned an empty response.');
  }
  const body = json as { ok?: boolean; data?: unknown; error?: string; code?: string };
  if (!body.ok) {
    throw new AppError(asCode(body.code), body.error || 'Request failed.');
  }
  return body.data;
}

type FetchLike = (url: string, init: RequestInit) => Promise<{ status: number; text: () => Promise<string> }>;

/**
 * POST JSON and fail clearly on timeout, offline, or a bad response.
 * Writes are not retried here — the caller reuses its idempotency key.
 */
export async function postJson(
  url: string,
  body: unknown,
  timeoutMs = 20000,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: controller.signal,
    });
    const text = await response.text();
    if (response.status >= 500) {
      throw new AppError('SERVER', 'The server had a problem. Nothing was changed. Try again.');
    }
    return parseApiText(text);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError') {
      throw new AppError('TIMEOUT', 'The server took too long. Check your connection and try again.');
    }
    throw new AppError('NETWORK', 'No connection. Your changes were not saved.');
  } finally {
    clearTimeout(timer);
  }
}
