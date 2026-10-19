import { ProjectStatus, TaskStatus } from '../types/models';
import { sectionColors } from './colors';

const NEUTRAL = '#8A9098';

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  Potential: NEUTRAL,
  'In Progress': sectionColors.projects,
  'On Hold': '#E8B85D',
  'In Testing': sectionColors.tasks,
  Completed: '#5DCF8B',
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  Open: '#E8B85D',
  'In Progress': sectionColors.projects,
  Complete: '#5DCF8B',
};

/** Unknown / malformed status values from the sheet fall back to a neutral colour. */
export function projectStatusColor(status: string): string {
  return PROJECT_STATUS_COLOR[status as ProjectStatus] ?? NEUTRAL;
}

export function taskStatusColor(status: string): string {
  return TASK_STATUS_COLOR[status as TaskStatus] ?? NEUTRAL;
}
