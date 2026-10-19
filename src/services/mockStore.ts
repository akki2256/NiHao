import { emptyState, ServerState } from '../domain/store';
import { nowIso } from '../utils/id';

/** SHA-256 of `calicon:Calicon@1234`. Matches apps-script/Code.gs. */
const DEMO_PASSWORD_HASH =
  'a7919e675fdc7cd8c01948a16dee261d86921d6d7d300c0a8d59860c50a1567c';

let state: ServerState | null = null;

/** Demo data used when EXPO_PUBLIC_API_URL is not set. */
export function ensureMockState(): ServerState {
  if (state) return state;
  const ts = nowIso();
  const day = ts.slice(0, 10);
  state = emptyState();
  state.data = {
    contributors: [
      {
        contributor_id: 'c_akhil',
        display_name: 'Akhil',
        username: 'akhil',
        password_hash: DEMO_PASSWORD_HASH,
        email: 'akhil@calicon.in',
        phone: '9000000001',
        active_code: 'active',
        push_token: '',
        updated_at: ts,
      },
      {
        contributor_id: 'c_chiranjeev',
        display_name: 'Chiranjeev',
        username: 'chiranjeev',
        password_hash: DEMO_PASSWORD_HASH,
        email: 'chiranjeev@calicon.in',
        phone: '9000000002',
        active_code: 'active',
        push_token: '',
        updated_at: ts,
      },
      {
        contributor_id: 'c_manav',
        display_name: 'Manav',
        username: 'manav',
        password_hash: DEMO_PASSWORD_HASH,
        email: 'manav@calicon.in',
        phone: '9000000003',
        active_code: 'active',
        push_token: '',
        updated_at: ts,
      },
    ],
    projects: [
      {
        project_id: 'p_yog',
        client_name: 'Yog Mantram',
        project_type: 'Website',
        status: 'In Progress',
        phone: '',
        email: '',
        address: '',
        started_date: day,
        completed_date: '',
        updated_at: ts,
        last_updated_by: 'c_akhil',
        active_code: 'active',
        version: 1,
      },
    ],
    project_comments: [],
    project_payments: [
      {
        payment_id: 'pay_yog_1',
        project_id: 'p_yog',
        amount: 20000,
        date: day,
        received_by: 'c_akhil',
        voided: 'no',
      },
    ],
    project_billing: [
      {
        billing_id: 'b_yog',
        project_id: 'p_yog',
        quoted_amount: 50000,
        final_amount: 50000,
        received_amount: 20000,
        pending_amount: 30000,
        gst_included: 'yes',
        version: 1,
      },
    ],
    project_contributors: [
      {
        id: 'pc_1',
        project_id: 'p_yog',
        contributor_id: 'c_akhil',
        active_status: 'active',
      },
    ],
    expenses: [],
    expense_contributors: [],
    tasks: [
      {
        task_id: 't_tm',
        task_name: 'Trademark registration',
        task_description: 'Company trademark filing',
        status: 'Open',
        created_by: 'c_manav',
        created_date: ts,
        active_status: 'active',
        updated_at: ts,
        version: 1,
      },
    ],
    task_comments: [],
    settlements: [],
  };
  return state;
}

export function getMockState(): ServerState {
  return ensureMockState();
}

export function setMockState(next: ServerState): void {
  state = next;
}
