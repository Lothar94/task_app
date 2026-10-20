import type { TaskDto } from './tasks.js';

/**
 * Operational state of a project, derived from its tasks (first match wins):
 * - `attention`: it has recoverable failed tasks (see `ProjectAlertDto`) waiting to be resumed.
 * - `running`: some task is pending, running or waiting for subtasks.
 * - `resting`: nothing is running but draft or queued tasks are waiting.
 * - `idle`: nothing is running or waiting.
 * Archived projects are reported with their computed status too; clients decide how to show them.
 */
export const PROJECT_STATUSES = ['attention', 'running', 'resting', 'idle'] as const;
export type ProjectOperationalStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Why a task failed in a way that can be retried by re-queuing it:
 * - `session_limit`: the Claude session/usage limit was reached.
 * - `token_limit`: the run hit a token, context or budget limit.
 * Any other failure is not recoverable and raises no alert.
 */
export const PROJECT_ALERT_KINDS = ['session_limit', 'token_limit'] as const;
export type ProjectAlertKind = (typeof PROJECT_ALERT_KINDS)[number];

/** Counts over every task of the project, subtasks included. */
export interface ProjectTaskCounts {
  total: number;
  completed: number;
  /** Pending, running or waiting for subtasks. */
  active: number;
  failed: number;
  cancelled: number;
  /** Draft or queued. */
  planned: number;
}

export interface ProjectAlertDto {
  kind: ProjectAlertKind;
  /** Failed root tasks with this kind of failure; "Reanudar" re-queues them. Never empty. */
  taskIds: string[];
}

/** The task an agent is working on right now: the most recently started running task. */
export interface ActiveSubtaskDto {
  taskId: string;
  taskNumber: number;
  title: string;
  agentId: string;
  agentName: string;
  /** ISO date the task started; the client derives the elapsed time from it. */
  startedAt: string;
}

export interface ProjectTelemetryDto {
  projectId: string;
  status: ProjectOperationalStatus;
  counts: ProjectTaskCounts;
  /** completed / (completed + failed); null when nothing finished yet. */
  successRate: number | null;
  /** Tokens of every run of the project (all kinds summed). */
  totalTokens: number;
  /** Estimate from the model's price table; on a subscription it is not what you pay. */
  costUsd: number;
  /** Agent working time summed over runs. */
  agentTimeMs: number;
  /** Latest of task created/started/finished and run finished dates; null without tasks. */
  lastActivityAt: string | null;
  /** Distinct agents with a pending, running or waiting task. */
  activeAgentIds: string[];
  activeSubtask: ActiveSubtaskDto | null;
  /** One entry per kind with at least one recoverable failed root task; empty otherwise. */
  alerts: ProjectAlertDto[];
}

/** Portfolio figures over the organization's non-archived projects. */
export interface ProjectsSummaryDto {
  activeProjects: number;
  /** Non-archived projects created in the last 7 days minus projects archived in the last 7 days. */
  activeProjectsWeeklyDelta: number;
  activeTasks: number;
  totalTasks: number;
  completedTasks: number;
  /** Distinct members of the non-archived projects. */
  swarmAgentIds: string[];
  totalTokens: number;
  costUsd: number;
}

/**
 * GET /api/organizations/:id/projects/telemetry — one entry per project of the organization
 * (archived ones included, same order as GET /api/organizations/:id/projects); 404 when the
 * organization does not exist. Clients refresh it on the `task.created` / `task.updated` SSE events
 * of GET /api/events and may bump `lastActivityAt` locally on `task.message_appended`.
 */
export interface ProjectsTelemetryDto {
  generatedAt: string;
  summary: ProjectsSummaryDto;
  projects: ProjectTelemetryDto[];
}

/**
 * POST /api/projects/:id/resume — re-queues every recoverable failed root task of the project (the
 * task ids of its alerts), oldest first, at the end of the queue; the queue then starts them one at
 * a time. Answers 200 with the re-queued tasks (empty when there is nothing to resume), 404 when the
 * project does not exist and 409 CONFLICT when it is archived. Clients must confirm before calling it.
 */
export interface ResumeProjectResultDto {
  requeued: TaskDto[];
}
