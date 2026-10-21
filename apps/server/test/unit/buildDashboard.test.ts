import type { ModelTokenUsage } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { localDateKey, localHourKey } from '../../src/application/metrics/activityBuckets.js';
import { buildDashboard } from '../../src/application/metrics/buildDashboard.js';
import { ModelPriceTable, pricingOf } from '../../src/application/metrics/ModelPriceTable.js';
import { Agent } from '../../src/domain/agent/Agent.js';
import { Project } from '../../src/domain/project/Project.js';
import { Task } from '../../src/domain/task/Task.js';
import type { TaskRun } from '../../src/domain/task/TaskRun.js';
import { profile } from '../support/testFleet.js';

const now = new Date(2026, 9, 12, 12, 0, 0);
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const usage = (model: string, input: number, output: number): ModelTokenUsage => ({
  model,
  inputTokens: input,
  outputTokens: output,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0.5,
});

const cto = Agent.create('cto', 'org', profile('CTO'), now);
const dev = Agent.create('dev', 'org', profile('Dev'), now);
const project = Project.create(
  'p1',
  'org',
  { name: 'Demo', description: '', workspacePath: '/tmp/demo' },
  [],
  now,
);

function task(
  id: string,
  number: number,
  agentId: string,
  end: 'completed' | 'failed' | 'active',
  finished: Date,
  { projectId = 'p1', parentTaskId = null }: { projectId?: string; parentTaskId?: string | null } = {},
) {
  const created = Task.create(
    id,
    { projectId, number, parentTaskId, agentId, title: id, description: 'd' },
    finished,
  );
  created.start(finished);
  if (end === 'completed') created.complete('ok', finished);
  if (end === 'failed') created.fail('boom', finished);
  return created;
}

function run(
  taskId: string,
  finished: Date,
  outcome: TaskRun['outcome'],
  models: ModelTokenUsage[],
  error: string | null = null,
): TaskRun {
  return {
    id: `r-${taskId}-${finished.getTime()}`,
    taskId,
    startedAt: new Date(finished.getTime() - 60_000),
    finishedAt: finished,
    outcome,
    error,
    numTurns: 2,
    llmMs: null,
    toolMs: null,
    models,
  };
}

const tasks = [
  task('t1', 1, 'cto', 'completed', daysAgo(1)),
  task('t2', 2, 'dev', 'failed', daysAgo(0)),
  task('t3', 3, 'dev', 'completed', daysAgo(20)),
  task('t4', 4, 'dev', 'active', daysAgo(0)),
];
const runs = [
  run('t1', daysAgo(1), 'completed', [usage('opus', 100, 10), usage('haiku', 5, 1)]),
  run('t2', daysAgo(0), 'failed', [usage('sonnet', 40, 4)], 'boom'),
  run('t3', daysAgo(20), 'completed', [usage('sonnet', 1000, 100)]),
];
const build = (days: number | null) =>
  buildDashboard({
    tasks,
    runs,
    agents: [cto, dev],
    projects: [project],
    filters: { projectId: null, days },
    now,
    prices: new ModelPriceTable(),
  });

describe('buildDashboard', () => {
  it('counts outcomes in the period and the tasks still running', () => {
    expect(build(7).totals).toMatchObject({ completed: 1, failed: 1, active: 1, successRate: 0.5, runs: 2 });
    expect(build(null).totals).toMatchObject({ completed: 2, failed: 1, successRate: 2 / 3 });
  });

  it('adds up tokens and agent time', () => {
    expect(build(7).totals).toMatchObject({
      inputTokens: 145,
      outputTokens: 15,
      totalTokens: 160,
      agentTimeMs: 120_000,
    });
  });

  it('breaks token usage down by model, biggest first', () => {
    expect(build(7).byModel.map((row) => [row.model, row.totalTokens, row.runs])).toEqual([
      ['opus', 110, 1],
      ['sonnet', 44, 1],
      ['haiku', 6, 1],
    ]);
  });

  it('summarises each agent', () => {
    expect(
      build(null).byAgent.map((row) => [row.agentName, row.completed, row.failed, row.totalTokens]),
    ).toEqual([
      ['Dev', 1, 1, 1144],
      ['CTO', 1, 0, 116],
    ]);
  });

  it('builds one bucket per day of the window', () => {
    const daily = build(7).daily;
    expect(daily).toHaveLength(7);
    expect(daily.at(-1)).toEqual({ date: localDateKey(now), totalTokens: 44, completed: 0, failed: 1 });
    expect(daily.at(-2)).toMatchObject({ totalTokens: 116, completed: 1 });
  });

  it('lists failed runs, newest first, with their context', () => {
    expect(build(null).errors).toEqual([
      expect.objectContaining({
        taskNumber: 2,
        taskTitle: 't2',
        projectName: 'Demo',
        agentName: 'Dev',
        error: 'boom',
      }),
    ]);
  });

  it('can focus on one project', () => {
    const other = buildDashboard({
      tasks,
      runs,
      agents: [],
      projects: [project],
      filters: { projectId: 'other', days: null },
      now,
      prices: new ModelPriceTable(),
    });
    expect(other.totals).toMatchObject({ completed: 0, totalTokens: 0, successRate: null });
  });
});

describe('buildDashboard costs', () => {
  const cached = (model: string): ModelTokenUsage => ({
    model,
    inputTokens: 1_000_000,
    outputTokens: 100_000,
    cacheReadTokens: 2_000_000,
    cacheCreationTokens: 400_000,
    costUsd: 9,
  });
  const costTasks = [task('c1', 1, 'dev', 'completed', daysAgo(0))];
  const costRuns = [
    run('c1', daysAgo(0), 'completed', [cached('claude-sonnet-5-5'), cached('mystery')]),
    { ...run('c1', daysAgo(0), 'completed', [cached('claude-sonnet-5-5')]), id: 'second' },
  ];
  const dashboard = buildDashboard({
    tasks: costTasks,
    runs: costRuns,
    agents: [dev],
    projects: [project],
    filters: { projectId: null, days: null },
    now,
    prices: new ModelPriceTable(),
  });
  // sonnet per run: input 3 + output 1.5 + cache write 1.5 + cache read 0.6 = 6.6; savings 2M × 2.7 = 5.4
  const sonnetCost = 6.6;

  it('estimates priced models with the table and keeps the reported cost of the rest', () => {
    const [sonnet, mystery] = dashboard.byModel;
    expect(sonnet).toMatchObject({ model: 'claude-sonnet-5-5', runs: 2, pricing: pricingOf(3, 15) });
    expect(sonnet?.costUsd).toBeCloseTo(2 * sonnetCost);
    expect(sonnet?.cost.inputUsd).toBeCloseTo(6);
    expect(sonnet?.cost.cacheReadUsd).toBeCloseTo(1.2);
    expect(sonnet?.cacheSavingsUsd).toBeCloseTo(10.8);
    expect(mystery).toMatchObject({
      model: 'mystery',
      pricing: null,
      costUsd: 9,
      cacheSavingsUsd: 0,
      cost: { inputUsd: 0, outputUsd: 0, cacheWriteUsd: 0, cacheReadUsd: 0 },
    });
  });

  it('applies the estimate to the totals and the agents', () => {
    expect(dashboard.totals.costUsd).toBeCloseTo(2 * sonnetCost + 9);
    expect(dashboard.totals.cacheSavingsUsd).toBeCloseTo(10.8);
    expect(dashboard.byAgent[0]?.costUsd).toBeCloseTo(2 * sonnetCost + 9);
  });

  it('counts each task with runs once', () => {
    expect(dashboard.totals).toMatchObject({ runs: 2, tasksRun: 1 });
    expect(build(null).totals.tasksRun).toBe(3);
  });
});

describe('buildDashboard periods', () => {
  it('compares with the window of the same length right before', () => {
    expect(build(15).previous).toMatchObject({ completed: 1, failed: 0, runs: 1, totalTokens: 1100, tasksRun: 1 });
    expect(build(7).previous).toMatchObject({ completed: 0, runs: 0, totalTokens: 0, successRate: null });
  });

  it('has no previous period for all time', () => {
    expect(build(null).previous).toBeNull();
  });

  it('uses 24 hourly buckets ending at the current hour for the last day', () => {
    const dashboard = build(1);
    expect(dashboard.activityGranularity).toBe('hour');
    expect(dashboard.daily).toHaveLength(24);
    expect(dashboard.daily.at(-1)).toEqual({ date: localHourKey(now), totalTokens: 44, completed: 0, failed: 1 });
    expect(dashboard.daily[0]?.date).toBe(localHourKey(new Date(now.getTime() - 23 * 3_600_000)));
    expect(localHourKey(now)).toMatch(/^\d{4}-\d{2}-\d{2}T12:00$/);
  });

  it('covers long filtered periods with one bucket per day', () => {
    const dashboard = build(365);
    expect(dashboard.activityGranularity).toBe('day');
    expect(dashboard.daily).toHaveLength(365);
    expect(dashboard.daily.find((day) => day.date === localDateKey(daysAgo(20)))).toMatchObject({
      totalTokens: 1100,
      completed: 1,
    });
  });

  it('starts the all-time chart at the first activity', () => {
    expect(build(null).daily).toHaveLength(21);
  });
});

describe('buildDashboard error causes', () => {
  const archived = Project.create('p2', 'org', { name: 'Old', description: '', workspacePath: '/tmp/old' }, [], now);
  archived.archive(now);
  const failedTasks = [
    task('f1', 1, 'dev', 'failed', daysAgo(0)),
    task('f2', 2, 'dev', 'failed', daysAgo(0), { projectId: 'p2' }),
    task('f3', 3, 'dev', 'failed', daysAgo(0), { parentTaskId: 'f1' }),
    task('f4', 4, 'dev', 'completed', daysAgo(0)),
  ];
  const at = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const failedRuns = [
    run('f1', at(1), 'failed', [], 'API Error: 429 Too Many Requests'),
    run('f2', at(2), 'failed', [], 'Claude AI usage limit reached'),
    run('f3', at(3), 'failed', [], 'Overloaded'),
    run('f4', at(4), 'failed', [], 'TypeError: boom'),
    run('f4', at(5), 'completed', []),
    ...Array.from({ length: 55 }, (_, index) => ({
      ...run('f4', daysAgo(2), 'failed', [], 'context window exceeded'),
      id: `old-${index}`,
    })),
  ];
  const dashboard = (days: number | null) =>
    buildDashboard({
      tasks: failedTasks,
      runs: failedRuns,
      agents: [dev],
      projects: [project, archived],
      filters: { projectId: null, days },
      now,
      prices: new ModelPriceTable(),
    });

  it('counts every failed run of the period by cause, most frequent first', () => {
    expect(dashboard(null)).toMatchObject({
      errorsTotal: 59,
      errorCauses: [
        { cause: 'token_limit', count: 55 },
        { cause: 'rate_limit', count: 2 },
        { cause: 'session_limit', count: 1 },
        { cause: 'other', count: 1 },
      ],
    });
    expect(dashboard(null).errors).toHaveLength(50);
    expect(dashboard(1).errorsTotal).toBe(4);
  });

  it('tags each error with its cause and whether the task can be re-queued', () => {
    expect(dashboard(1).errors.map((row) => [row.taskId, row.cause, row.retryable])).toEqual([
      ['f1', 'rate_limit', true],
      ['f2', 'session_limit', false],
      ['f3', 'rate_limit', false],
      ['f4', 'other', false],
    ]);
  });
});
