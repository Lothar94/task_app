import type { ModelTokenUsage, TaskMetricsDto, TokenTotals } from '@fleet/shared';
import type { TaskRun } from '../../domain/task/TaskRun.js';
import type { ModelPriceTable } from './ModelPriceTable.js';

export const EMPTY_TOTALS: TokenTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalTokens: 0,
  costUsd: 0,
};

export function totalsOfModel(usage: ModelTokenUsage): TokenTotals {
  const { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd } = usage;
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
    costUsd,
  };
}

export function addTotals<T extends TokenTotals>(target: T, extra: TokenTotals): T {
  return {
    ...target,
    inputTokens: target.inputTokens + extra.inputTokens,
    outputTokens: target.outputTokens + extra.outputTokens,
    cacheReadTokens: target.cacheReadTokens + extra.cacheReadTokens,
    cacheCreationTokens: target.cacheCreationTokens + extra.cacheCreationTokens,
    totalTokens: target.totalTokens + extra.totalTokens,
    costUsd: target.costUsd + extra.costUsd,
  };
}

export function totalsOfRun(run: TaskRun): TokenTotals {
  return run.models.map(totalsOfModel).reduce(addTotals, EMPTY_TOTALS);
}

/** Token totals with the cost estimated from the price table. */
export function estimatedTotals(usage: ModelTokenUsage, prices: ModelPriceTable): TokenTotals {
  return { ...totalsOfModel(usage), costUsd: prices.estimate(usage).costUsd };
}

export const estimatedTotalsOfRun = (run: TaskRun, prices: ModelPriceTable) =>
  run.models.map((usage) => estimatedTotals(usage, prices)).reduce(addTotals, EMPTY_TOTALS);

export const runDurationMs = (run: TaskRun) =>
  Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime());

export function summarizeRuns(runs: TaskRun[]): TaskMetricsDto {
  return runs.reduce<TaskMetricsDto>(
    (metrics, run) => ({
      ...addTotals(metrics, totalsOfRun(run)),
      runs: metrics.runs + 1,
      durationMs: metrics.durationMs + runDurationMs(run),
    }),
    { ...EMPTY_TOTALS, runs: 0, durationMs: 0 },
  );
}

export function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
