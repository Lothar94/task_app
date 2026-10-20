import type { TaskExecutionDto } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { hasSubtreeTokens, runLabel, timeSegments } from './executionModel';

const metrics = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0 };
const run = (number: number, outcome: 'completed' | 'failed' | 'cancelled') => ({
  number,
  startedAt: '',
  finishedAt: '',
  durationMs: 1,
  outcome,
  totalTokens: 1,
  costUsd: 0,
});
const execution = (runs: ReturnType<typeof run>[], ownTokens = 10, subtreeTokens = 10): TaskExecutionDto => ({
  taskId: 't',
  own: { ...metrics, totalTokens: ownTokens, runs: runs.length, durationMs: 0 },
  subtree: { ...metrics, totalTokens: subtreeTokens, runs: runs.length, durationMs: 0 },
  time: null,
  models: [],
  primaryModel: null,
  runs,
});

describe('timeSegments', () => {
  it('computes whole percentages per segment', () => {
    const segments = timeSegments({ totalMs: 1000, llmMs: 500, toolMs: 250, ioMs: 250 });

    expect(segments.map((segment) => segment.percent)).toEqual([50, 25, 25]);
    expect(segments.map((segment) => segment.label)).toEqual(['LLM', 'Herramientas', 'IO']);
  });

  it('gives 0% everywhere when the total is zero', () => {
    const segments = timeSegments({ totalMs: 0, llmMs: 0, toolMs: 0, ioMs: 0 });

    expect(segments.every((segment) => segment.percent === 0)).toBe(true);
  });
});

describe('runLabel', () => {
  it('is null without runs', () => {
    expect(runLabel(execution([]), 'completed')).toBeNull();
  });

  it.each([
    ['completed', '#2 completada'],
    ['failed', '#2 fallida'],
    ['cancelled', '#2 cancelada'],
  ] as const)('labels the last run outcome %s', (outcome, label) => {
    expect(runLabel(execution([run(1, 'failed'), run(2, outcome)]), 'completed')).toBe(label);
  });

  it('says "en curso" while the task runs', () => {
    expect(runLabel(execution([run(1, 'completed')]), 'running')).toBe('#1 en curso');
  });
});

describe('hasSubtreeTokens', () => {
  it('is true only when the subtree differs from the own total', () => {
    expect(hasSubtreeTokens(execution([], 10, 30))).toBe(true);
    expect(hasSubtreeTokens(execution([], 10, 10))).toBe(false);
  });
});
