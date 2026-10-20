import type { ModelTokenUsage } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { buildProjectsTelemetry } from '../../src/application/projects/buildProjectsTelemetry.js';
import { Agent } from '../../src/domain/agent/Agent.js';
import { Project } from '../../src/domain/project/Project.js';
import { Task } from '../../src/domain/task/Task.js';
import type { TaskRun } from '../../src/domain/task/TaskRun.js';
import { profile } from '../support/testFleet.js';

const now = new Date('2026-10-20T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

const dev = Agent.create('dev', 'org', profile('Dev'), now);
const qa = Agent.create('qa', 'org', profile('QA'), now);

const details = { name: 'Demo', description: '', workspacePath: '/tmp/demo' };
function project(id: string, memberIds: string[] = [], createdAt = daysAgo(30), archivedAt?: Date) {
  const created = Project.create(id, 'org', details, memberIds, createdAt);
  if (archivedAt) created.archive(archivedAt);
  return created;
}

type Stage = 'draft' | 'queued' | 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
interface Options {
  number?: number;
  parent?: string | null;
  agentId?: string;
  created?: Date;
  started?: Date;
  reason?: string;
}

function task(id: string, projectId: string, stage: Stage, options: Options = {}) {
  const created = options.created ?? daysAgo(2);
  const instance = Task.create(
    id,
    {
      projectId,
      number: options.number ?? 1,
      parentTaskId: options.parent ?? null,
      agentId: options.agentId ?? 'dev',
      title: id,
      description: 'd',
    },
    created,
    stage === 'draft' || stage === 'queued' ? 'draft' : 'pending',
  );
  const started = options.started ?? created;
  const finish: Partial<Record<Stage, () => void>> = {
    queued: () => instance.enqueue(1),
    running: () => instance.start(started),
    waiting: () => {
      instance.start(started);
      instance.waitForSubtasks();
    },
    completed: () => {
      instance.start(started);
      instance.complete('ok', hoursAgo(5));
    },
    failed: () => {
      instance.start(started);
      instance.fail(options.reason ?? 'boom', hoursAgo(4));
    },
    cancelled: () => instance.cancel(hoursAgo(3)),
  };
  finish[stage]?.();
  return instance;
}

const usage: ModelTokenUsage = {
  model: 'm',
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0.25,
};
const run = (taskId: string, finishedAt: Date, ms = 1000): TaskRun => ({
  id: `run-${taskId}-${finishedAt.getTime()}`,
  taskId,
  startedAt: new Date(finishedAt.getTime() - ms),
  finishedAt,
  outcome: 'completed',
  error: null,
  numTurns: 1,
  llmMs: null,
  toolMs: null,
  models: [usage],
});

const build = (input: { tasks?: Task[]; runs?: TaskRun[]; projects: Project[] }) =>
  buildProjectsTelemetry({ tasks: [], runs: [], agents: [dev, qa], now, ...input });

describe('buildProjectsTelemetry', () => {
  it('reports an empty project as idle without activity', () => {
    const [entry] = build({ projects: [project('p1')] }).projects;
    expect(entry).toMatchObject({
      projectId: 'p1',
      status: 'idle',
      successRate: null,
      lastActivityAt: null,
      activeSubtask: null,
      alerts: [],
      activeAgentIds: [],
      totalTokens: 0,
    });
    expect(entry?.counts).toEqual({ total: 0, completed: 0, active: 0, failed: 0, cancelled: 0, planned: 0 });
  });

  describe('status', () => {
    const statusOf = (...stages: Stage[]) =>
      build({
        projects: [project('p1')],
        tasks: stages.map((stage, index) => task(`t${index}`, 'p1', stage, { number: index + 1 })),
      }).projects[0]?.status;

    it('is idle when everything finished', () => {
      expect(statusOf('completed', 'cancelled', 'failed')).toBe('idle');
    });
    it('is resting with draft or queued tasks only', () => {
      expect(statusOf('draft', 'completed')).toBe('resting');
      expect(statusOf('queued')).toBe('resting');
    });
    it('is running with a pending, running or waiting task, even with planned ones', () => {
      expect(statusOf('pending', 'queued')).toBe('running');
      expect(statusOf('running')).toBe('running');
      expect(statusOf('waiting', 'draft')).toBe('running');
    });
    it('is attention when a recoverable failure exists, beating running', () => {
      const tasks = [
        task('f', 'p1', 'failed', { reason: 'Claude AI usage limit reached' }),
        task('r', 'p1', 'running', { number: 2 }),
      ];
      expect(build({ projects: [project('p1')], tasks }).projects[0]?.status).toBe('attention');
    });
    it('ignores generic failures', () => {
      expect(statusOf('failed')).toBe('idle');
    });
  });

  it('counts every task including subtasks and derives the success rate', () => {
    const tasks = [
      task('a', 'p1', 'completed', { number: 1 }),
      task('b', 'p1', 'completed', { number: 2, parent: 'a' }),
      task('c', 'p1', 'failed', { number: 3 }),
      task('d', 'p1', 'cancelled', { number: 4 }),
      task('e', 'p1', 'running', { number: 5 }),
      task('f', 'p1', 'queued', { number: 6 }),
      task('g', 'p1', 'draft', { number: 7 }),
    ];
    const [entry] = build({ projects: [project('p1')], tasks }).projects;
    expect(entry?.counts).toEqual({ total: 7, completed: 2, active: 1, failed: 1, cancelled: 1, planned: 2 });
    expect(entry?.successRate).toBeCloseTo(2 / 3);
  });

  it('sums run totals per project and ignores other projects', () => {
    const tasks = [task('a', 'p1', 'completed'), task('b', 'p2', 'completed')];
    const runs = [run('a', hoursAgo(5), 2000), run('a', hoursAgo(4), 3000), run('b', hoursAgo(4))];
    const [first, second] = build({ projects: [project('p1'), project('p2')], tasks, runs }).projects;
    expect(first).toMatchObject({ totalTokens: 30, costUsd: 0.5, agentTimeMs: 5000 });
    expect(second).toMatchObject({ totalTokens: 15, costUsd: 0.25, agentTimeMs: 1000 });
  });

  it('takes the latest of task and run dates as last activity', () => {
    const tasks = [task('a', 'p1', 'completed', { created: daysAgo(3), started: daysAgo(2) })];
    const withRun = build({ projects: [project('p1')], tasks, runs: [run('a', hoursAgo(1))] });
    expect(withRun.projects[0]?.lastActivityAt).toBe(hoursAgo(1).toISOString());
    const withoutRun = build({ projects: [project('p1')], tasks });
    expect(withoutRun.projects[0]?.lastActivityAt).toBe(hoursAgo(5).toISOString());
  });

  describe('active subtask', () => {
    it('picks the running task started last, breaking ties by highest number', () => {
      const tasks = [
        task('old', 'p1', 'running', { number: 1, started: hoursAgo(5) }),
        task('tie-low', 'p1', 'running', { number: 2, started: hoursAgo(1), agentId: 'qa' }),
        task('tie-high', 'p1', 'running', { number: 3, started: hoursAgo(1), agentId: 'qa' }),
        task('waiting', 'p1', 'waiting', { number: 4, started: hoursAgo(0.5) }),
      ];
      const [entry] = build({ projects: [project('p1')], tasks }).projects;
      expect(entry?.activeSubtask).toEqual({
        taskId: 'tie-high',
        taskNumber: 3,
        title: 'tie-high',
        agentId: 'qa',
        agentName: 'QA',
        startedAt: hoursAgo(1).toISOString(),
      });
      expect(entry?.activeAgentIds).toEqual(['dev', 'qa']);
    });

    it('falls back to the agent id when the agent was deleted', () => {
      const tasks = [task('t', 'p1', 'running', { agentId: 'gone' })];
      const [entry] = build({ projects: [project('p1')], tasks }).projects;
      expect(entry?.activeSubtask?.agentName).toBe('gone');
    });

    it('is null without running tasks', () => {
      const tasks = [task('t', 'p1', 'waiting')];
      expect(build({ projects: [project('p1')], tasks }).projects[0]?.activeSubtask).toBeNull();
    });
  });

  describe('alerts', () => {
    it('groups failed root tasks per kind, oldest first, skipping empty kinds', () => {
      const tasks = [
        task('s-new', 'p1', 'failed', { number: 1, created: daysAgo(1), reason: 'usage limit reached' }),
        task('s-old', 'p1', 'failed', { number: 2, created: daysAgo(4), reason: "You've hit your limit" }),
        task('generic', 'p1', 'failed', { number: 3, reason: 'crash' }),
        task('sub', 'p1', 'failed', { number: 4, parent: 's-old', reason: 'usage limit reached' }),
        task('done', 'p1', 'completed', { number: 5 }),
      ];
      const [entry] = build({ projects: [project('p1')], tasks }).projects;
      expect(entry?.alerts).toEqual([{ kind: 'session_limit', taskIds: ['s-old', 's-new'] }]);
    });

    it('reports both kinds', () => {
      const tasks = [
        task('t1', 'p1', 'failed', { number: 1, reason: 'prompt is too long' }),
        task('t2', 'p1', 'failed', { number: 2, reason: 'session limit' }),
      ];
      const [entry] = build({ projects: [project('p1')], tasks }).projects;
      expect(entry?.alerts).toEqual([
        { kind: 'session_limit', taskIds: ['t2'] },
        { kind: 'token_limit', taskIds: ['t1'] },
      ]);
    });
  });

  describe('summary', () => {
    it('totals only non-archived projects and keeps the project order', () => {
      const projects = [
        project('p1', ['dev', 'qa']),
        project('archived', ['ghost'], daysAgo(30), daysAgo(20)),
        project('p2', ['qa']),
      ];
      const tasks = [
        task('a', 'p1', 'completed', { number: 1 }),
        task('b', 'p1', 'running', { number: 2 }),
        task('c', 'archived', 'completed'),
        task('d', 'p2', 'queued'),
      ];
      const runs = [run('a', hoursAgo(5)), run('c', hoursAgo(5))];
      const result = build({ projects, tasks, runs });
      expect(result.projects.map((entry) => entry.projectId)).toEqual(['p1', 'archived', 'p2']);
      expect(result.generatedAt).toBe(now.toISOString());
      expect(result.summary).toMatchObject({
        activeProjects: 2,
        activeTasks: 1,
        totalTasks: 3,
        completedTasks: 1,
        swarmAgentIds: ['dev', 'qa'],
        totalTokens: 15,
        costUsd: 0.25,
      });
    });

    it('subtracts projects archived in the last 7 days from those created in the last 7 days', () => {
      const projects = [
        project('new1', [], daysAgo(2)),
        project('new2', [], daysAgo(6)),
        project('old', [], daysAgo(20)),
        project('new-archived', [], daysAgo(3), daysAgo(1)),
        project('old-archived-recently', [], daysAgo(30), daysAgo(5)),
        project('old-archived-long-ago', [], daysAgo(30), daysAgo(15)),
      ];
      expect(build({ projects }).summary).toMatchObject({
        activeProjects: 3,
        activeProjectsWeeklyDelta: 2 - 2,
      });
    });

    it('can be negative', () => {
      const projects = [project('x', [], daysAgo(30), daysAgo(1)), project('y', [], daysAgo(30), daysAgo(2))];
      expect(build({ projects }).summary.activeProjectsWeeklyDelta).toBe(-2);
    });
  });
});
