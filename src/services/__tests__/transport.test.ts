import { AppError } from '../../domain/errors';
import { parseApiText, postJson } from '../transport';

describe('parseApiText', () => {
  it('returns data when ok', () => {
    expect(parseApiText(JSON.stringify({ ok: true, data: { n: 1 } }))).toEqual({ n: 1 });
  });

  it.each([
    ['<html>error</html>', 'MALFORMED'],
    [JSON.stringify({ ok: false, code: 'AUTH_EXPIRED', error: 'sign in' }), 'AUTH_EXPIRED'],
    [JSON.stringify({ ok: false, code: 'CONFLICT', error: 'stale' }), 'CONFLICT'],
    [JSON.stringify({ ok: false, error: 'nope' }), 'SERVER'],
    ['', 'MALFORMED'],
  ])('maps %p to %p', (text, code) => {
    expect(() => parseApiText(text)).toThrow(AppError);
    try {
      parseApiText(text);
    } catch (error) {
      expect((error as AppError).code).toBe(code);
    }
  });
});

describe('postJson', () => {
  const ok = async () => ({ status: 200, text: async () => JSON.stringify({ ok: true, data: 1 }) });

  it('returns parsed data', async () => {
    await expect(postJson('https://example.test', { a: 1 }, 1000, ok)).resolves.toBe(1);
  });

  it('turns an abort into a timeout', async () => {
    const hanging = (_url: string, init: RequestInit) =>
      new Promise<never>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    await expect(postJson('https://example.test', {}, 15, hanging)).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('turns a network failure into NETWORK', async () => {
    const offline = async () => {
      throw new Error('offline');
    };
    await expect(postJson('https://example.test', {}, 1000, offline)).rejects.toMatchObject({
      code: 'NETWORK',
    });
  });

  it('turns a 500 into SERVER without parsing a body', async () => {
    const down = async () => ({ status: 503, text: async () => 'upstream' });
    await expect(postJson('https://example.test', {}, 1000, down)).rejects.toMatchObject({
      code: 'SERVER',
    });
  });
});
