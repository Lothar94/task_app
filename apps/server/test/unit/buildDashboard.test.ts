import type { ModelTokenUsage } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { buildDashboard, localDateKey } from '../../src/application/metrics/buildDashboard.js';
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

const cto = Agent.create('cto', profile('CTO'), now);
const dev = Agent.create('dev', profile('Dev'), now);
const project = Project.create('p1', { name: 'Demo', description: '', workspacePath: '/tmp/demo' }, [], now);

function task(
  id: string,
  number: number,
  agentId: string,
  end: 'completed' | 'failed' | 'active',
  finished: Date,
) {
  const created = Task.create(
    id,
    { projectId: 'p1', number, parentTaskId: null, agentId, title: id, description: 'd' },
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
    });
    expect(other.totals).toMatchObject({ completed: 0, totalTokens: 0, successRate: null });
  });
});
