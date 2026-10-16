import type { TaskMetricsDto } from './metrics.js';

export const TASK_STATUSES = [
  /** Defined by the project manager but not started: waits until it is started or queued. */
  'draft',
  /** Waiting in the project queue; starts automatically when its turn comes. */
  'queued',
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
  /**
   * Agent that proposed the task while working on another one, or null when the project manager
   * created it. Proposed tasks are always top-level drafts: they never start without the project
   * manager's confirmation (start or queue).
   */
  proposedByAgentId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  resultSummary: string | null;
  /** Free-text milestone the task belongs to, if any. */
  milestone: string | null;
  /** Free-text labels, trimmed and unique (case-insensitive), in the order given. */
  tags: string[];
  /** 1-based position in the project queue while the task is queued; null otherwise. */
  queuePosition: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TaskNodeDto extends TaskDto {
  metrics: TaskMetricsDto;
  children: TaskNodeDto[];
}

/**
 * What happens right after a task is created:
 * - `now`: the agent starts working immediately (default, previous behaviour).
 * - `draft`: the task is only defined; it starts when the project manager says so.
 * - `queue`: the task is appended to the project queue.
 */
export const TASK_START_MODES = ['now', 'draft', 'queue'] as const;
export type TaskStartMode = (typeof TASK_START_MODES)[number];

export const TASK_LIMITS = { titleLength: 200, milestoneLength: 80, tagLength: 40, maxTags: 10 } as const;

export interface AssignTaskInput {
  agentId: string;
  title: string;
  description: string;
  /** Defaults to `now`. */
  start?: TaskStartMode;
  milestone?: string | null;
  tags?: string[];
}

/**
 * Partial update of a task. Title, description and agent can only change while the task is
 * `draft` or `queued`; milestone and tags can change at any time.
 */
export interface UpdateTaskInput {
  agentId?: string;
  title?: string;
  description?: string;
  milestone?: string | null;
  tags?: string[];
}

/** New order of the project queue: exactly the ids of the currently queued tasks. */
export interface ReorderQueueInput {
  taskIds: string[];
}

export interface FollowUpInput {
  message: string;
}
