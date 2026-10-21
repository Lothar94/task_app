import type { TaskStatus } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { buildFleetStatus } from '../../src/application/fleet/buildFleetStatus.js';

const now = new Date('2026-03-01T10:00:00.000Z');
const agents = [
  { id: 'a1', name: 'Zoe' },
  { id: 'a2', name: 'Ana' },
  { id: 'a3', name: 'Bob' },
];
const task = (agentId: string, status: TaskStatus) => ({ agentId, status });

describe('buildFleetStatus', () => {
  it('is idle without active tasks, whatever the finished or planned ones', () => {
    const statuses: TaskStatus[] = ['pending', 'draft', 'queued', 'completed', 'failed', 'cancelled'];
    const status = buildFleetStatus({
      agents,
      tasks: statuses.map((s) => task('a1', s)),
      version: '1.0.0',
      now,
    });
    expect(status).toEqual({
      state: 'idle',
      activeNodes: [],
      totalAgents: 3,
      activeTasks: 0,
      version: '1.0.0',
      generatedAt: now.toISOString(),
    });
  });

  it('counts running and waiting_subtasks tasks as active', () => {
    const status = buildFleetStatus({
      agents,
      tasks: [task('a1', 'running'), task('a2', 'waiting_subtasks'), task('a3', 'completed')],
      version: '1.0.0',
      now,
    });
    expect(status.state).toBe('active');
    expect(status.activeTasks).toBe(2);
    expect(status.activeNodes.map((node) => node.agentId)).toEqual(['a2', 'a1']);
  });

  it('orders nodes by load desc, then name asc', () => {
    const status = buildFleetStatus({
      agents,
      tasks: [
        task('a1', 'running'),
        task('a3', 'running'),
        task('a2', 'running'),
        task('a1', 'waiting_subtasks'),
      ],
      version: '1.0.0',
      now,
    });
    expect(status.activeNodes).toEqual([
      { agentId: 'a1', name: 'Zoe', activeTasks: 2 },
      { agentId: 'a2', name: 'Ana', activeTasks: 1 },
      { agentId: 'a3', name: 'Bob', activeTasks: 1 },
    ]);
  });

  it('counts tasks of unknown agents as active but lists no node for them', () => {
    const status = buildFleetStatus({ agents, tasks: [task('ghost', 'running')], version: 'v', now });
    expect(status.activeTasks).toBe(1);
    expect(status.activeNodes).toEqual([]);
  });
});
