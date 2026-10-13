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
  /** Only activity of the last N days; null means all time. */
  days: number | null;
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
}

export interface ModelUsageRow extends TokenTotals {
  model: string;
  runs: number;
}

export interface AgentUsageRow extends TokenTotals {
  agentId: string;
  agentName: string;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface DailyActivity {
  /** Local date, YYYY-MM-DD. */
  date: string;
  totalTokens: number;
  completed: number;
  failed: number;
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
  occurredAt: string;
}

export interface DashboardDto {
  filters: DashboardFilters;
  totals: DashboardTotals;
  byModel: ModelUsageRow[];
  byAgent: AgentUsageRow[];
  daily: DailyActivity[];
  errors: RunErrorRow[];
}
