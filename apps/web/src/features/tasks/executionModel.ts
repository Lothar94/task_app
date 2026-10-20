import type { RunOutcome, TaskExecutionDto, TaskStatus, TimeBreakdown } from '@fleet/shared';

export type TimeSegmentKey = 'llm' | 'tool' | 'io';

export interface TimeSegment {
  key: TimeSegmentKey;
  label: string;
  ms: number;
  /** Whole percentage of the total; 0 when the total is 0. */
  percent: number;
}

/** Splits a time breakdown into bar segments; every percentage is 0 when `totalMs` is 0. */
export function timeSegments(time: TimeBreakdown): TimeSegment[] {
  const percentOf = (ms: number) => (time.totalMs > 0 ? Math.round((ms / time.totalMs) * 100) : 0);
  return [
    { key: 'llm', label: 'LLM', ms: time.llmMs, percent: percentOf(time.llmMs) },
    { key: 'tool', label: 'Herramientas', ms: time.toolMs, percent: percentOf(time.toolMs) },
    { key: 'io', label: 'IO', ms: time.ioMs, percent: percentOf(time.ioMs) },
  ];
}

const OUTCOME_LABELS: Record<RunOutcome, string> = {
  completed: 'completada',
  failed: 'fallida',
  cancelled: 'cancelada',
};

/** "#3 fallida" from the last run; "#3 en curso" while the task is running; null with no runs. */
export function runLabel(execution: TaskExecutionDto, status: TaskStatus): string | null {
  const last = execution.runs.at(-1);
  if (!last) return null;
  return `#${last.number} ${status === 'running' ? 'en curso' : OUTCOME_LABELS[last.outcome]}`;
}

/** Whether delegated subtasks add tokens beyond the task's own, so "X con árbol" is worth showing. */
export const hasSubtreeTokens = (execution: TaskExecutionDto) =>
  execution.subtree.totalTokens !== execution.own.totalTokens;
