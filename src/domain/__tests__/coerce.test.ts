import { AppError } from '../errors';
import { coerceAppData } from '../coerce';

describe('coerceAppData', () => {
  it('repairs sheet quirks and strips secrets', () => {
    const { data, warnings } = coerceAppData({
      contributors: [
        {
          contributor_id: 'c1',
          display_name: 'Akhil',
          username: 'akhil',
          password_hash: 'secret-hash',
          push_token: 'ExponentPushToken[abc]',
          email: 'a@b.co',
          phone: 9000000001,
          active_code: 'active',
        },
      ],
      projects: [
        { project_id: '', client_name: 'Missing id' },
        {
          project_id: 'p1',
          client_name: 'Yog',
          started_date: '2026-10-17T00:00:00.000Z',
          phone: 9811111111,
        },
      ],
      project_payments: [{ payment_id: 'pay1', project_id: 'p1', amount: '1,500', voided: 'yes' }],
      expenses: 'not-a-list',
    });

    expect(data.contributors[0].password_hash).toBeUndefined();
    expect(data.contributors[0].push_token).toBeUndefined();
    expect(data.contributors[0].phone).toBe('9000000001');
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].started_date).toBe('2026-10-17');
    expect(data.projects[0].active_code).toBe('active');
    expect(data.project_payments[0].amount).toBe(1500);
    expect(data.project_payments[0].voided).toBe('yes');
    expect(data.expenses).toEqual([]);
    expect(warnings.some((w) => w.includes('no project_id'))).toBe(true);
    expect(warnings.some((w) => w.includes('expenses'))).toBe(true);
  });

  it('rejects a payload that is not an object', () => {
    expect(() => coerceAppData(null)).toThrow(AppError);
    expect(() => coerceAppData([])).toThrow(AppError);
  });
});
