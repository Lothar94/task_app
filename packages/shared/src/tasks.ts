import type { TaskMetricsDto } from './metrics.js';

export const TASK_STATUSES = [
  'pending',
  'running',
  'waiting_subtasks',
  'completed',
  'failed',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskDto {
  id: string;
  /** Sequential per project: shown as "Tarea N". */
  number: number;
  projectId: string;
  parentTaskId: string | null;
  agentId: string;
  title: string;
  description: string;
  status: TaskStatus;
  resultSummary: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TaskNodeDto extends TaskDto {
  metrics: TaskMetricsDto;
  children: TaskNodeDto[];
}

export interface AssignTaskInput {
  agentId: string;
  title: string;
  description: string;
}

export interface FollowUpInput {
  message: string;
}
