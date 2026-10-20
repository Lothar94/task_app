import type { ModelTokenUsage } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { GetTaskExecution } from '../../src/application/metrics/GetTaskExecution.js';
import type { TaskRepository } from '../../src/application/ports/TaskRepository.js';
import type { TaskRunRepository } from '../../src/application/ports/TaskRunRepository.js';
import { NotFoundError } from '../../src/domain/errors/DomainError.js';
import type { Task } from '../../src/domain/task/Task.js';
import type { TaskRun } from '../../src/domain/task/TaskRun.js';

const usage = (model: string, tokens: number, costUsd: number): ModelTokenUsage => ({
  model,
  inputTokens: tokens,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd,
});

function run(taskId: string, startSecond: number, overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: `${taskId}-${startSecond}`,
    taskId,
    startedAt: new Date(startSecond * 1000),
    finishedAt: new Date((startSecond + 10) * 1000),
    outcome: 'completed',
    error: null,
    numTurns: 1,
    llmMs: null,
    toolMs: null,
    models: [],
    ...overrides,
  };
}

/** Task tree: root -> child -> grandchild; `other` is unrelated. */
function build(runs: TaskRun[]) {
  const children: Record<string, string[]> = { root: ['child'], child: ['grandchild'] };
  const known = new Set(['root', 'child', 'grandchild', 'other']);
  const tasks = {
    findById: (id: string) => (known.has(id) ? ({ id } as Task) : null),
    findChildren: (id: string) => (children[id] ?? []).map((child) => ({ id: child }) as Task),
  } as unknown as TaskRepository;
  const repository = {
    findByTaskIds: (ids: readonly string[]) =>
      runs.filter((candidate) => ids.includes(candidate.taskId)).sort((a, b) => +a.startedAt - +b.startedAt),
  } as unknown as TaskRunRepository;
  return new GetTaskExecution(tasks, repository);
}

describe('GetTaskExecution', () => {
  it('rejects unknown tasks', () => {
    expect(() => build([]).execute('nope')).toThrow(NotFoundError);
  });

  it('adds every descendant, at any depth, to the subtree only', () => {
    const execution = build([
      run('root', 0, { models: [usage('m', 10, 1)] }),
      run('child', 20, { models: [usage('m', 20, 2)] }),
      run('grandchild', 40, { models: [usage('m', 40, 4)] }),
      run('other', 60, { models: [usage('m', 80, 8)] }),
    ]).execute('root');

    expect(execution.own).toMatchObject({ runs: 1, totalTokens: 10, costUsd: 1 });
    expect(execution.subtree).toMatchObject({ runs: 3, totalTokens: 70, costUsd: 7, durationMs: 30_000 });
    expect(build([run('grandchild', 0)]).execute('child').subtree.runs).toBe(1);
  });

  it('has no time breakdown when only legacy runs exist or there are none', () => {
    expect(build([run('root', 0)]).execute('root').time).toBeNull();
    expect(build([]).execute('root')).toMatchObject({ time: null, models: [], primaryModel: null, runs: [] });
  });

  it('splits time over the runs with timing, leaving legacy runs out', () => {
    const { time } = build([
      run('root', 0),
      run('root', 100, { llmMs: 4000, toolMs: 3000 }),
      run('root', 200, { llmMs: 1000, toolMs: 0 }),
    ]).execute('root');

    expect(time).toEqual({ totalMs: 20_000, llmMs: 5000, toolMs: 3000, ioMs: 12_000 });
  });

  it('never reports negative io time', () => {
    const { time } = build([run('root', 0, { llmMs: 9000, toolMs: 9000 })]).execute('root');

    expect(time).toEqual({ totalMs: 10_000, llmMs: 9000, toolMs: 9000, ioMs: 0 });
  });

  it('merges models by name, most expensive first, and picks the primary one', () => {
    const execution = build([
      run('root', 0, { models: [usage('haiku', 100, 0.1), usage('opus', 10, 1)] }),
      run('root', 20, { models: [usage('haiku', 100, 0.1)] }),
    ]).execute('root');

    expect(execution.models.map((model) => [model.model, model.inputTokens, model.costUsd])).toEqual([
      ['opus', 10, 1],
      ['haiku', 200, 0.2],
    ]);
    expect(execution.primaryModel).toBe('opus');
  });

  it('breaks a cost tie with the model that used more tokens', () => {
    const { primaryModel } = build([
      run('root', 0, { models: [usage('small', 10, 1), usage('big', 500, 1)] }),
    ]).execute('root');

    expect(primaryModel).toBe('big');
  });

  it('lists own runs numbered by start order', () => {
    const { runs } = build([
      run('root', 50, { outcome: 'failed', models: [usage('m', 5, 0.5)] }),
      run('root', 0),
    ]).execute('root');

    expect(
      runs.map(({ number, outcome, totalTokens, durationMs }) => [number, outcome, totalTokens, durationMs]),
    ).toEqual([
      [1, 'completed', 0, 10_000],
      [2, 'failed', 5, 10_000],
    ]);
    expect(runs[0]?.startedAt).toBe('1970-01-01T00:00:00.000Z');
  });
});
