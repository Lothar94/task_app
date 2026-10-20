import type { ModelTokenUsage, TaskExecutionDto, TaskRunSummary, TimeBreakdown } from '@fleet/shared';
import type { Task } from '../../domain/task/Task.js';
import type { TaskRun } from '../../domain/task/TaskRun.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskRunRepository } from '../ports/TaskRunRepository.js';
import { requireTask } from '../shared/lookups.js';
import { runDurationMs, summarizeRuns, totalsOfModel, totalsOfRun } from './usageMath.js';

/** Telemetry of one task: its own runs, its whole subtree, time split, models and run list. */
export class GetTaskExecution {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly runs: TaskRunRepository,
  ) {}

  execute(taskId: string): TaskExecutionDto {
    const task = requireTask(this.tasks, taskId);
    const subtreeIds = this.subtreeIds(task);
    const subtreeRuns = this.runs.findByTaskIds(subtreeIds);
    const ownRuns = subtreeRuns.filter((run) => run.taskId === taskId);
    const models = mergeModels(ownRuns);
    return {
      taskId,
      own: summarizeRuns(ownRuns),
      subtree: summarizeRuns(subtreeRuns),
      time: timeBreakdown(ownRuns),
      models,
      primaryModel: models[0]?.model ?? null,
      runs: ownRuns.map(toRunSummary),
    };
  }

  /** The task and all its descendants, walking one level of children at a time. */
  private subtreeIds(root: Task): string[] {
    const ids = [root.id];
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index];
      if (id === undefined) break;
      ids.push(...this.tasks.findChildren(id).map((child) => child.id));
    }
    return ids;
  }
}

function toRunSummary(run: TaskRun, index: number): TaskRunSummary {
  return {
    number: index + 1,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt.toISOString(),
    durationMs: runDurationMs(run),
    outcome: run.outcome,
    totalTokens: totalsOfRun(run).totalTokens,
    costUsd: totalsOfRun(run).costUsd,
  };
}

function timeBreakdown(runs: TaskRun[]): TimeBreakdown | null {
  const timed = runs.filter((run) => run.llmMs !== null && run.toolMs !== null);
  if (timed.length === 0) return null;
  const sum = (valueOf: (run: TaskRun) => number) => timed.reduce((total, run) => total + valueOf(run), 0);
  const totalMs = sum(runDurationMs);
  const llmMs = sum((run) => run.llmMs ?? 0);
  const toolMs = sum((run) => run.toolMs ?? 0);
  return { totalMs, llmMs, toolMs, ioMs: Math.max(0, totalMs - llmMs - toolMs) };
}

/** Sums usage by model name; the most expensive comes first (ties: more tokens, then name). */
function mergeModels(runs: TaskRun[]): ModelTokenUsage[] {
  const byModel = new Map<string, ModelTokenUsage>();
  for (const usage of runs.flatMap((run) => run.models)) {
    const known = byModel.get(usage.model);
    byModel.set(
      usage.model,
      known
        ? {
            model: usage.model,
            inputTokens: known.inputTokens + usage.inputTokens,
            outputTokens: known.outputTokens + usage.outputTokens,
            cacheReadTokens: known.cacheReadTokens + usage.cacheReadTokens,
            cacheCreationTokens: known.cacheCreationTokens + usage.cacheCreationTokens,
            costUsd: known.costUsd + usage.costUsd,
          }
        : usage,
    );
  }
  return [...byModel.values()].sort(
    (a, b) =>
      b.costUsd - a.costUsd ||
      totalsOfModel(b).totalTokens - totalsOfModel(a).totalTokens ||
      a.model.localeCompare(b.model),
  );
}
