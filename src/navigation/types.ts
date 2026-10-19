import { NavigatorScreenParams } from '@react-navigation/native';
import { Expense, Project, Task } from '../types/models';

export type MainTabParamList = {
  Projects: undefined;
  Tasks: undefined;
  Home: undefined;
  Contributors: undefined;
  Expenses: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  ProjectDetail: { projectId: string };
  ProjectForm: { project?: Project };
  TaskDetail: { taskId: string };
  TaskForm: { task?: Task };
  ExpenseDetail: { expenseId: string };
  ExpenseForm: { expense?: Expense };
  ContributorEdit: undefined;
  RecentlyDeleted: undefined;
  Settings: undefined;
  Balances: { projectId?: string } | undefined;
};
