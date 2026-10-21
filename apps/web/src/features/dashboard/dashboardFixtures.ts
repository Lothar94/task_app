import type { DashboardDto, DashboardTotals, ModelUsageRow, RunErrorRow } from '@fleet/shared';

export const totals = (overrides: Partial<DashboardTotals> = {}): DashboardTotals => ({
  inputTokens: 1000,
  outputTokens: 2000,
  cacheReadTokens: 7000,
  cacheCreationTokens: 500,
  totalTokens: 10_500,
  costUsd: 10,
  completed: 8,
  failed: 2,
  cancelled: 1,
  active: 3,
  successRate: 0.8,
  runs: 12,
  tasksRun: 10,
  agentTimeMs: 600_000,
  cacheSavingsUsd: 30,
  ...overrides,
});

export const modelRow = (overrides: Partial<ModelUsageRow> = {}): ModelUsageRow => ({
  model: 'claude-sonnet-4-5',
  inputTokens: 1000,
  outputTokens: 2000,
  cacheReadTokens: 7000,
  cacheCreationTokens: 500,
  totalTokens: 10_500,
  costUsd: 10,
  runs: 12,
  pricing: { inputPerMTok: 3, outputPerMTok: 15, cacheWritePerMTok: 3.75, cacheReadPerMTok: 0.3 },
  cost: { inputUsd: 1, outputUsd: 2, cacheWriteUsd: 3, cacheReadUsd: 4 },
  cacheSavingsUsd: 30,
  ...overrides,
});

export const errorRow = (overrides: Partial<RunErrorRow> = {}): RunErrorRow => ({
  runId: 'run-1',
  taskId: 'task-1',
  taskNumber: 7,
  taskTitle: 'Arreglar login',
  projectId: 'p1',
  projectName: 'Task app',
  agentName: 'Ana',
  error: 'boom',
  occurredAt: '2026-10-21T08:00:00.000Z',
  cause: 'other',
  retryable: false,
  ...overrides,
});

export const dashboard = (overrides: Partial<DashboardDto> = {}): DashboardDto => ({
  filters: { projectId: null, days: 30 },
  totals: totals(),
  previous: null,
  activityGranularity: 'day',
  byModel: [modelRow()],
  byAgent: [],
  daily: [{ date: '2026-10-20', totalTokens: 100, completed: 1, failed: 0 }],
  errors: [],
  errorsTotal: 0,
  errorCauses: [],
  ...overrides,
});
