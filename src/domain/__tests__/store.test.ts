import { AppError } from '../errors';
import { emptyState, passwordMatches, reduce, ServerState } from '../store';
import { Contributor } from '../../types/models';

function hashOf(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const deps = {
  hash: async (value: string) => hashOf(value),
  token: (() => {
    let n = 0;
    return () => `id_${++n}`;
  })(),
  now: () => new Date('2026-10-17T09:00:00.000Z'),
};

function user(over: Partial<Contributor> = {}): Contributor {
  return {
    contributor_id: 'c1',
    display_name: 'Akhil',
    username: 'akhil',
    password_hash: hashOf('calicon:secret'),
    email: 'akhil@calicon.in',
    phone: '9000000001',
    active_code: 'active',
    push_token: 'ExponentPushToken[abc]',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...over,
  };
}

function seeded(): ServerState {
  const state = emptyState();
  state.data.contributors.push(user());
  return state;
}

async function signIn(state: ServerState = seeded()) {
  const out = await reduce(state, 'login', { identifier: 'akhil', password: 'secret' }, deps);
  const result = out.result as { token: string; user: Contributor };
  return { state: out.state, token: result.token, user: result.user };
}

describe('login and sessions', () => {
  it('accepts a legacy hash, upgrades it, and hides secrets', async () => {
    const { state, user: signedIn } = await signIn();
    expect(signedIn.password_hash).toBeUndefined();
    expect(signedIn.push_token).toBeUndefined();
    expect(state.data.contributors[0].password_hash?.startsWith('v2$')).toBe(true);
    expect(await passwordMatches(deps.hash, state.data.contributors[0].password_hash || '', 'secret')).toBe(
      true,
    );
  });

  it('rejects a wrong password and an unknown user', async () => {
    const state = seeded();
    await expect(
      reduce(state, 'login', { identifier: 'akhil', password: 'nope' }, deps),
    ).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    await expect(
      reduce(state, 'login', { identifier: 'nobody', password: 'secret' }, deps),
    ).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('rejects bootstrap once the session has expired', async () => {
    const { state, token } = await signIn();
    const later = { ...deps, now: () => new Date('2026-12-01T00:00:00.000Z') };
    await expect(reduce(state, 'bootstrap', { token }, later)).rejects.toMatchObject({
      code: 'AUTH_EXPIRED',
    });
  });

  it('does not put password hashes in bootstrap data', async () => {
    const { state, token } = await signIn();
    const out = await reduce(state, 'bootstrap', { token }, deps);
    const data = out.result as { contributors: Contributor[] };
    expect(data.contributors[0].password_hash).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('ExponentPushToken');
  });
});

describe('writes', () => {
  it('runs the project, payment, void, delete and restore flow', async () => {
    const signed = await signIn();
    let state = signed.state;

    const created = await reduce(
      state,
      'saveProject',
      {
        token: signed.token,
        idempotencyKey: 'create-1',
        project: { client_name: 'Yog Mantram', project_type: 'Website', phone: '9000000001' },
      },
      deps,
    );
    state = created.state;
    const project = created.result as { project_id: string; version: number; last_updated_by: string };
    expect(project.version).toBe(1);
    expect(project.last_updated_by).toBe('c1');
    expect(state.data.project_billing).toHaveLength(1);

    const again = await reduce(
      state,
      'saveProject',
      {
        token: signed.token,
        idempotencyKey: 'create-1',
        project: { client_name: 'Yog Mantram' },
      },
      deps,
    );
    expect(again.state.data.projects).toHaveLength(1);

    await expect(
      reduce(
        state,
        'saveProject',
        { token: signed.token, idempotencyKey: 'dup', project: { client_name: 'yog mantram' } },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'DUPLICATE' });

    const paid = await reduce(
      state,
      'addPayment',
      { token: signed.token, idempotencyKey: 'pay-1', projectId: project.project_id, amount: 10000 },
      deps,
    );
    state = paid.state;
    expect(state.data.project_billing[0].received_amount).toBe(10000);
    expect(state.data.project_billing[0].pending_amount).toBe(0);

    const payment = paid.result as { payment_id: string };
    const voided = await reduce(
      state,
      'voidPayment',
      { token: signed.token, idempotencyKey: 'void-1', paymentId: payment.payment_id, reason: 'Entered twice' },
      deps,
    );
    state = voided.state;
    expect(state.data.project_payments[0].voided).toBe('yes');
    expect(state.data.project_billing[0].received_amount).toBe(0);
    expect(state.data.project_payments).toHaveLength(1);

    const removed = await reduce(
      state,
      'setActive',
      {
        token: signed.token,
        idempotencyKey: 'del-1',
        sheet: 'projects',
        id: project.project_id,
        active: false,
        expectedVersion: state.data.projects[0].version,
      },
      deps,
    );
    state = removed.state;
    expect(state.data.projects[0].active_code).toBe('inactive');

    const restored = await reduce(
      state,
      'setActive',
      {
        token: signed.token,
        idempotencyKey: 'restore-1',
        sheet: 'projects',
        id: project.project_id,
        active: true,
        expectedVersion: state.data.projects[0].version,
      },
      deps,
    );
    expect(restored.state.data.projects[0].active_code).toBe('active');
  });

  it('rejects a stale project edit', async () => {
    const signed = await signIn();
    const created = await reduce(
      signed.state,
      'saveProject',
      { token: signed.token, project: { project_id: 'p1', client_name: 'Alpha' } },
      deps,
    );
    await expect(
      reduce(
        created.state,
        'saveProject',
        {
          token: signed.token,
          expectedVersion: 0,
          project: { project_id: 'p1', client_name: 'Alpha renamed' },
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      reduce(
        created.state,
        'saveProject',
        {
          token: signed.token,
          expectedVersion: 0,
          project: { project_id: 'p1', client_name: 'Alpha renamed' },
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects bad amounts, dates and a void with no reason', async () => {
    const signed = await signIn();
    const created = await reduce(
      signed.state,
      'saveProject',
      { token: signed.token, project: { project_id: 'p1', client_name: 'Alpha' } },
      deps,
    );
    await expect(
      reduce(
        created.state,
        'addPayment',
        { token: signed.token, projectId: 'p1', amount: -5 },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      reduce(
        created.state,
        'addPayment',
        { token: signed.token, projectId: 'p1', amount: 10, date: '2026-02-31' },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      reduce(
        created.state,
        'saveProject',
        {
          token: signed.token,
          expectedVersion: 1,
          project: { project_id: 'p1', client_name: 'Alpha', phone: '12' },
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    const paid = await reduce(
      created.state,
      'addPayment',
      { token: signed.token, projectId: 'p1', amount: 10 },
      deps,
    );
    await expect(
      reduce(
        paid.state,
        'voidPayment',
        { token: signed.token, paymentId: (paid.result as { payment_id: string }).payment_id, reason: ' ' },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(paid.state.data.project_payments[0].voided).not.toBe('yes');
  });

  it('records the signed-in user, not a spoofed one', async () => {
    const signed = await signIn();
    const created = await reduce(
      signed.state,
      'saveProject',
      {
        token: signed.token,
        project: { client_name: 'Beta', last_updated_by: 'c_someone_else' },
      },
      deps,
    );
    expect((created.result as { last_updated_by: string }).last_updated_by).toBe('c1');
  });
});
