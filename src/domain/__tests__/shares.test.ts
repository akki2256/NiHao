import { Expense, ProjectBilling, ProjectPayment, Settlement } from '../../types/models';
import {
  companyBalances,
  equalShares,
  fromPaise,
  inclusiveGst,
  projectShares,
  toPaise,
} from '../shares';

const billing = (gst: 'yes' | 'no', final = 1000): ProjectBilling => ({
  billing_id: 'b1',
  project_id: 'p1',
  quoted_amount: final,
  final_amount: final,
  received_amount: 0,
  pending_amount: final,
  gst_included: gst,
  version: 1,
});

const pay = (amount: number, received_by: string): ProjectPayment => ({
  payment_id: 'pay1',
  project_id: 'p1',
  amount,
  date: '2026-10-17',
  received_by,
  voided: 'no',
});

describe('inclusiveGst', () => {
  it('turns 1000 into a net of 847.46 and GST of 152.54', () => {
    const parts = inclusiveGst(toPaise(1000));
    expect(fromPaise(parts.netPaise)).toBe(847.46);
    expect(fromPaise(parts.gstPaise)).toBe(152.54);
    expect(parts.netPaise + parts.gstPaise).toBe(toPaise(1000));
  });
});

describe('equalShares', () => {
  it('gives the extra paise to the earliest people', () => {
    expect(equalShares(100, 3)).toEqual([34, 33, 33]);
    expect(equalShares(84746, 3).reduce((sum, n) => sum + n, 0)).toBe(84746);
  });
});

describe('projectShares', () => {
  const members = ['c_chiranjeev', 'c_akhil', 'c_manav'];

  it('splits a GST payment three ways and leaves the tax with the receiver', () => {
    const result = projectShares(billing('yes'), [pay(1000, 'c_akhil')], members);
    expect(fromPaise(result.billNetPaise)).toBe(847.46);
    expect(fromPaise(result.receivedNetPaise)).toBe(847.46);
    expect(fromPaise(result.gstHeld[0].paise)).toBe(152.54);
    expect(result.gstHeld[0].contributorId).toBe('c_akhil');
    const owed = result.edges.filter((edge) => edge.fromId === 'c_akhil');
    expect(owed).toHaveLength(2);
    expect(owed.reduce((sum, edge) => sum + edge.paise, 0)).toBe(
      result.receivedNetPaise - result.receivedShares.find((s) => s.contributorId === 'c_akhil')!.paise,
    );
  });

  it('does not take GST off a non-GST project', () => {
    const result = projectShares(billing('no'), [pay(1000, 'c_akhil')], ['c_akhil', 'c_manav']);
    expect(result.billGstPaise).toBe(0);
    expect(result.gstHeld).toEqual([]);
    expect(result.edges).toEqual([{ fromId: 'c_akhil', toId: 'c_manav', paise: 50000 }]);
  });

  it('reduces the debt when a linked transfer is logged', () => {
    const settlement: Settlement = {
      settlement_id: 's1',
      from_contributor_id: 'c_akhil',
      to_contributor_id: 'c_manav',
      amount: 200,
      date: '2026-10-18',
      project_id: 'p1',
      expense_id: '',
      note: '',
      created_by: 'c_akhil',
      created_at: '2026-10-18T00:00:00.000Z',
      voided: 'no',
    };
    const result = projectShares(
      billing('no'),
      [pay(1000, 'c_akhil')],
      ['c_akhil', 'c_manav'],
      [settlement],
    );
    expect(result.edges).toEqual([{ fromId: 'c_akhil', toId: 'c_manav', paise: 30000 }]);
  });

  it('re-splits when the people on the project change', () => {
    const three = projectShares(billing('no', 900), [pay(900, 'c_akhil')], members);
    const two = projectShares(billing('no', 900), [pay(900, 'c_akhil')], ['c_akhil', 'c_manav']);
    expect(three.receivedShares).toHaveLength(3);
    expect(two.edges.find((edge) => edge.toId === 'c_manav')?.paise).toBe(45000);
  });

  it('makes a removed receiver owe the people who remain', () => {
    const result = projectShares(billing('no', 900), [pay(900, 'c_chiranjeev')], ['c_akhil', 'c_manav']);
    expect(result.edges).toEqual([
      { fromId: 'c_chiranjeev', toId: 'c_akhil', paise: 45000 },
      { fromId: 'c_chiranjeev', toId: 'c_manav', paise: 45000 },
    ]);
  });
});

describe('companyBalances', () => {
  it('nets a project debt against an expense the other way', () => {
    const expense: Expense = {
      expense_id: 'e1',
      title: 'Hosting',
      notes: '',
      amount: 300,
      paid_by: 'c_manav',
      expense_date: '2026-10-17',
      recurring_status: 'no',
      frequency: '',
      active_code: 'active',
      updated_at: '',
      version: 1,
    };
    const edges = companyBalances({
      contributors: [],
      projects: [
        {
          project_id: 'p1',
          client_name: 'Yog',
          project_type: '',
          status: 'In Progress',
          phone: '',
          email: '',
          address: '',
          started_date: '',
          completed_date: '',
          updated_at: '',
          last_updated_by: 'c_akhil',
          active_code: 'active',
          version: 1,
        },
      ],
      project_comments: [],
      project_payments: [pay(1000, 'c_akhil')],
      project_billing: [billing('no')],
      project_contributors: [
        { id: '1', project_id: 'p1', contributor_id: 'c_akhil', active_status: 'active' },
        { id: '2', project_id: 'p1', contributor_id: 'c_manav', active_status: 'active' },
      ],
      expenses: [expense],
      expense_contributors: [
        { id: '3', expense_id: 'e1', contributor_id: 'c_akhil', active_status: 'active' },
        { id: '4', expense_id: 'e1', contributor_id: 'c_manav', active_status: 'active' },
      ],
      tasks: [],
      task_comments: [],
      settlements: [],
    });
    // Akhil owes Manav 500 from the project. Manav's expense means Akhil owes Manav 150 more? 
    // Expense 300 split 2 ways: Akhil owes Manav 150. Project: Akhil owes Manav 500.
    // Total Akhil owes Manav 650.
    expect(edges).toEqual([{ fromId: 'c_akhil', toId: 'c_manav', paise: 65000 }]);
  });
});
