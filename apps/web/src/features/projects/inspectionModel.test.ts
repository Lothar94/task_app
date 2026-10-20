import type { AgentDto, ProjectDto, TaskNodeDto } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import {
  findOrchestrator,
  recentRoots,
  resolveInspected,
  taskElapsedMs,
  tokensPerMinute,
  topologyRows,
} from './inspectionModel';

const task = (id: string, patch: Partial<TaskNodeDto> = {}): TaskNodeDto =>
  ({
    id,
    number: 1,
    agentId: 'a1',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    children: [],
    ...patch,
  }) as TaskNodeDto;
const agent = (id: string, collaboratorIds: string[] = []): AgentDto =>
  ({ id, name: id.toUpperCase(), role: 'Rol', model: 'opus', collaboratorIds }) as AgentDto;

describe('recentRoots', () => {
  it('orders by createdAt desc, number desc on ties, and limits', () => {
    const tree = [
      task('old', { number: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
      task('tie-a', { number: 2, createdAt: '2026-01-02T00:00:00.000Z' }),
      task('tie-b', { number: 3, createdAt: '2026-01-02T00:00:00.000Z' }),
      task('new', { number: 4, createdAt: '2026-01-03T00:00:00.000Z' }),
    ];
    expect(recentRoots(tree, 3).map((t) => t.id)).toEqual(['new', 'tie-b', 'tie-a']);
    expect(tree[0].id).toBe('old');
  });
});

describe('taskElapsedMs', () => {
  const start = '2026-01-01T00:00:00.000Z';
  const now = Date.parse(start) + 5000;
  it('is live for active tasks', () => {
    expect(taskElapsedMs(task('t', { status: 'running', startedAt: start }), now)).toBe(5000);
  });
  it('is fixed for finished tasks', () => {
    const finishedAt = '2026-01-01T00:00:02.000Z';
    expect(taskElapsedMs(task('t', { startedAt: start, finishedAt }), now)).toBe(2000);
  });
  it('is null when never started', () => {
    expect(taskElapsedMs(task('t', { status: 'queued' }), now)).toBeNull();
  });
});

describe('findOrchestrator', () => {
  it('returns null without members', () => {
    expect(findOrchestrator([], [task('t')])).toBeNull();
  });
  it('uses the agent of the latest root that is a member', () => {
    const tree = [
      task('t1', { agentId: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      task('t2', { agentId: 'x', createdAt: '2026-01-03T00:00:00.000Z' }),
      task('t3', { agentId: 'b', createdAt: '2026-01-02T00:00:00.000Z' }),
    ];
    expect(findOrchestrator([agent('a'), agent('b')], tree)?.id).toBe('b');
  });
  it('falls back to the member nobody delegates to, alphabetically', () => {
    const members = [agent('c', ['d']), agent('d'), agent('b', ['d'])];
    expect(findOrchestrator(members, [])?.id).toBe('b');
  });
  it('falls back to the first member when all delegate in a cycle', () => {
    expect(findOrchestrator([agent('a', ['b']), agent('b', ['a'])], [])?.id).toBe('a');
  });
});

describe('topologyRows', () => {
  it('lists state, orchestrator and delegation only to members', () => {
    const rows = topologyRows([agent('a', ['b', 'out']), agent('b')], 'a', new Set(['b']));
    expect(rows[0]).toMatchObject({ state: 'idle', isOrchestrator: true, delegatesTo: ['B'] });
    expect(rows[1]).toMatchObject({ state: 'trabajando', isOrchestrator: false, delegatesTo: [] });
  });
});

describe('tokensPerMinute', () => {
  it('is null without working time', () => {
    expect(tokensPerMinute({ tokens: 500, costUsd: 0, workingMs: 0 })).toBeNull();
  });
  it('averages over working minutes', () => {
    expect(tokensPerMinute({ tokens: 1200, costUsd: 0, workingMs: 120_000 })).toBe(600);
  });
});

describe('resolveInspected', () => {
  const projects = [{ id: 'p1' }, { id: 'p2' }] as ProjectDto[];
  it('picks the requested project, else the first', () => {
    expect(resolveInspected(projects, 'p2')?.id).toBe('p2');
    expect(resolveInspected(projects, 'zz')?.id).toBe('p1');
    expect(resolveInspected([], null)).toBeNull();
  });
});
