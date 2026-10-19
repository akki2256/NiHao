export type ProjectStatus =
  | 'Potential'
  | 'In Progress'
  | 'On Hold'
  | 'In Testing'
  | 'Completed';

export type TaskStatus = 'Open' | 'In Progress' | 'Complete';

export type RecurringFrequency = '' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export interface Contributor {
  contributor_id: string;
  display_name: string;
  username: string;
  email: string;
  phone: string;
  active_code: 'active' | 'inactive';
  /** Present only on the server. Never sent to the app or written to the device cache. */
  password_hash?: string;
  /** Present only on the server. */
  push_token?: string;
  updated_at: string;
}

export interface Project {
  project_id: string;
  client_name: string;
  project_type: string;
  status: ProjectStatus;
  phone: string;
  email: string;
  address: string;
  started_date: string;
  completed_date: string;
  updated_at: string;
  last_updated_by: string;
  /** Missing means active (rows created before this column existed). */
  active_code?: 'active' | 'inactive';
  /** Incremented on every successful write. Used to reject stale updates. */
  version?: number;
}

export interface ProjectComment {
  comment_id: string;
  project_id: string;
  comment: string;
  added_by: string;
  added_date: string;
  active_code: 'active' | 'inactive';
}

export interface ProjectPayment {
  payment_id: string;
  project_id: string;
  amount: number;
  date: string;
  received_by: string;
  /** Payments are never edited or deleted. A mistake is voided. */
  voided?: 'yes' | 'no' | '';
  void_reason?: string;
  voided_by?: string;
  voided_at?: string;
}

export interface ProjectBilling {
  billing_id: string;
  project_id: string;
  quoted_amount: number;
  final_amount: number;
  received_amount: number;
  pending_amount: number;
  gst_included: 'yes' | 'no';
  version?: number;
}

export interface ProjectContributor {
  id: string;
  project_id: string;
  contributor_id: string;
  active_status: 'active' | 'inactive';
}

export interface Expense {
  expense_id: string;
  title: string;
  notes: string;
  amount: number;
  paid_by: string;
  expense_date: string;
  recurring_status: 'yes' | 'no';
  frequency: RecurringFrequency;
  active_code: 'active' | 'inactive';
  updated_at: string;
  version?: number;
}

export interface ExpenseContributor {
  id: string;
  expense_id: string;
  contributor_id: string;
  active_status: 'active' | 'inactive';
}

export interface Task {
  task_id: string;
  task_name: string;
  task_description: string;
  status: TaskStatus;
  created_by: string;
  created_date: string;
  active_status: 'active' | 'inactive';
  updated_at: string;
  version?: number;
}

/** A teammate handing another teammate their share. */
export interface Settlement {
  settlement_id: string;
  from_contributor_id: string;
  to_contributor_id: string;
  amount: number;
  date: string;
  /** Set when this transfer settles one project. Otherwise empty. */
  project_id: string;
  /** Set when this transfer settles one expense. Otherwise empty. */
  expense_id: string;
  note: string;
  created_by: string;
  created_at: string;
  voided?: 'yes' | 'no' | '';
  void_reason?: string;
}

export interface TaskComment {
  comment_id: string;
  task_id: string;
  comment: string;
  added_by: string;
  added_date: string;
  active_code: 'active' | 'inactive';
}

export interface AppData {
  contributors: Contributor[];
  projects: Project[];
  project_comments: ProjectComment[];
  project_payments: ProjectPayment[];
  project_billing: ProjectBilling[];
  project_contributors: ProjectContributor[];
  expenses: Expense[];
  expense_contributors: ExpenseContributor[];
  tasks: Task[];
  task_comments: TaskComment[];
  settlements: Settlement[];
}

export type SheetName = keyof AppData;
