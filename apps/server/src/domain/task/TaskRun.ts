import type { ModelTokenUsage, RunOutcome } from '@fleet/shared';

/** One execution of an agent on a task: the first run or a follow-up. */
export interface TaskRun {
  id: string;
  taskId: string;
  startedAt: Date;
  finishedAt: Date;
  outcome: RunOutcome;
  error: string | null;
  numTurns: number | null;
  /** Time waiting for the model API; null for runs recorded before timing existed. */
  llmMs: number | null;
  /** Time between tool calls and their results (overlaps counted once); null for legacy runs. */
  toolMs: number | null;
  models: ModelTokenUsage[];
}
