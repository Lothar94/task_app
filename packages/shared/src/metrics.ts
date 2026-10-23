export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  /** Sum of the four token kinds above. */
  totalTokens: number;
  /** Estimate from Claude Code's price table; on a subscription it is not what you pay. */
  costUsd: number;
}

export interface ModelTokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
}

export interface TaskMetricsDto extends TokenTotals {
  /** Times an agent ran on the task (the first run plus each follow-up). */
  runs: number;
  /** Time the agent spent working, summed over runs. */
  durationMs: number;
}

export type RunOutcome = 'completed' | 'failed' | 'cancelled';

export interface DashboardFilters {
  projectId: string | null;
  /** Only activity of the last N days (1 = last 24 hours); null means all time. */
  days: number | null;
}

/** USD per million tokens of each kind, from the server's configurable price table. */
export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWritePerMTok: number;
  cacheReadPerMTok: number;
}

/** Estimated cost split by token kind, in USD. */
export interface CostBreakdown {
  inputUsd: number;
  outputUsd: number;
  cacheWriteUsd: number;
  cacheReadUsd: number;
}

export interface DashboardTotals extends TokenTotals {
  completed: number;
  failed: number;
  cancelled: number;
  active: number;
  /** completed / (completed + failed); null when nothing finished yet. */
  successRate: number | null;
  runs: number;
  agentTimeMs: number;
  /** Distinct tasks with at least one run in the period; divides agentTimeMs for the per-task average. */
  tasksRun: number;
  /** What cache reads would have cost at the input price minus what they cost. */
  cacheSavingsUsd: number;
}

/**
 * Dashboard rows estimate costUsd with the server price table; models without a price
 * fall back to the cost reported by Claude Code (pricing null, cost all zero).
 */
export interface ModelUsageRow extends TokenTotals {
  model: string;
  runs: number;
  pricing: ModelPricing | null;
  cost: CostBreakdown;
  cacheSavingsUsd: number;
}

export interface AgentUsageRow extends TokenTotals {
  agentId: string;
  agentName: string;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface DailyActivity {
  /** Local date YYYY-MM-DD, or local hour YYYY-MM-DDTHH:00 when activityGranularity is 'hour'. */
  date: string;
  totalTokens: number;
  completed: number;
  failed: number;
}

export const RUN_ERROR_CAUSES = [
  'rate_limit',
  'session_limit',
  'token_limit',
  'interrupted',
  'other',
] as const;

export type RunErrorCause = (typeof RUN_ERROR_CAUSES)[number];

export interface RunErrorCauseCount {
  cause: RunErrorCause;
  count: number;
}

export interface RunErrorRow {
  runId: string;
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  projectId: string;
  projectName: string;
  agentName: string;
  error: string;
  cause: RunErrorCause;
  /** The task is still a failed top-level task of an active project, so it can be re-queued. */
  retryable: boolean;
  occurredAt: string;
}

export type ActivityGranularity = 'day' | 'hour';

export interface DashboardDto {
  filters: DashboardFilters;
  totals: DashboardTotals;
  /** Same totals over the window right before the period; null for all time. */
  previous: DashboardTotals | null;
  byModel: ModelUsageRow[];
  byAgent: AgentUsageRow[];
  /** Hourly buckets for the 24-hour period (days = 1), daily otherwise. */
  activityGranularity: ActivityGranularity;
  daily: DailyActivity[];
  /** Most recent failed runs, at most 50. */
  errors: RunErrorRow[];
  /** Every failed run of the period, not only the listed ones. */
  errorsTotal: number;
  /** Failed runs of the period by cause, most frequent first; causes without runs are left out. */
  errorCauses: RunErrorCauseCount[];
}
