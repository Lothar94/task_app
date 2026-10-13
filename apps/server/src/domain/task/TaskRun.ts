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
  models: ModelTokenUsage[];
}
