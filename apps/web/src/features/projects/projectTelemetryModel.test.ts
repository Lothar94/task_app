import type { TaskNodeDto, TaskStatus } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { portfolioTelemetry, projectStatus, projectTelemetry, treeTotals } from './projectTelemetryModel';

const metrics = (totalTokens: number, durationMs: number, costUsd: number) => ({
  runs: 1,
  durationMs,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalTokens,
  costUsd,
});

const task = (
  status: TaskStatus,
  overrides: Partial<TaskNodeDto> = {},
  children: TaskNodeDto[] = [],
): TaskNodeDto =>
  ({
    id: Math.random().toString(),
    agentId: 'a1',
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    metrics: metrics(100, 1000, 0.5),
    children,
    ...overrides,
  }) as TaskNodeDto;

describe('project telemetry model', () => {
  it('sums tokens, cost and working time through subtasks', () => {
    const totals = treeTotals([task('completed', {}, [task('completed')]), task('completed')]);
    expect(totals).toEqual({ tokens: 300, costUsd: 1.5, workingMs: 3000 });
  });

  it('derives counts, success rate and bar percentages', () => {
    const t = projectTelemetry([
      task('completed'),
      task('completed'),
      task('completed'),
      task('failed'),
      task('running'),
    ]);
    expect(t.counts.total).toBe(5);
    expect(t.successRate).toBe(0.75);
    expect(t.completedPercent).toBe(60);
    expect(t.failedPercent).toBe(20);
    expect(t.activeAgents).toBe(1);
  });

  it('has no success rate or bar for an empty project', () => {
    const t = projectTelemetry([]);
    expect(t.successRate).toBeNull();
    expect(t.completedPercent).toBe(0);
    expect(t.lastActivityAt).toBeNull();
  });

  it('picks the latest timestamp among all tasks', () => {
    const t = projectTelemetry([
      task('completed', { finishedAt: '2026-03-02T10:00:00.000Z' }),
      task('running', {}, [task('running', { startedAt: '2026-04-01T09:00:00.000Z' })]),
    ]);
    expect(t.lastActivityAt).toBe('2026-04-01T09:00:00.000Z');
  });

  it('prioritises attention over running over idle', () => {
    const status = (...nodes: TaskNodeDto[]) => projectTelemetry(nodes).status;
    expect(status(task('running'), task('failed'))).toBe('attention');
    expect(status(task('running'))).toBe('running');
    expect(status(task('completed'))).toBe('idle');
    expect(projectStatus({ total: 0, active: 0, planned: 0, queued: 0, completed: 0, failed: 0 })).toBe(
      'idle',
    );
  });

  it('aggregates projects for the headline tiles', () => {
    const a = projectTelemetry([task('running'), task('completed')]);
    const b = projectTelemetry([task('completed')]);
    expect(portfolioTelemetry([a, b])).toEqual({
      activeTasks: 1,
      totalTasks: 3,
      completedTasks: 2,
      tokens: 300,
      costUsd: 1.5,
    });
  });
});
