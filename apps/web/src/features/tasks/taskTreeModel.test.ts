import type { TaskMetricsDto, TaskNodeDto, TaskStatus } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import {
  collectActiveAgentIds,
  countDescendants,
  countTasks,
  findNode,
  subtreeMetrics,
} from './taskTreeModel';

const metrics = (tokens: number, durationMs: number): TaskMetricsDto => ({
  runs: 1,
  durationMs,
  inputTokens: tokens,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalTokens: tokens,
  costUsd: 0,
});

const node = (
  agentId: string,
  status: TaskStatus,
  children: TaskNodeDto[] = [],
  tokens = 0,
): TaskNodeDto => ({
  id: `${agentId}-${status}`,
  number: 1,
  projectId: 'p',
  parentTaskId: null,
  agentId,
  title: 't',
  description: 'd',
  status,
  resultSummary: null,
  milestone: null,
  tags: [],
  queuePosition: null,
  createdAt: '',
  startedAt: null,
  finishedAt: null,
  metrics: metrics(tokens, tokens * 10),
  children,
});

const tree = [
  node(
    'cto',
    'waiting_subtasks',
    [node('backend', 'running', [node('qa', 'failed', [], 5)], 20), node('frontend', 'completed', [], 30)],
    100,
  ),
  node('solo', 'completed'),
];

describe('task tree model', () => {
  it('collects agents with pending, running or waiting tasks at any depth', () => {
    expect(collectActiveAgentIds(tree)).toEqual(new Set(['cto', 'backend']));
  });

  it('adds up the metrics of a task and everything it delegated', () => {
    expect(subtreeMetrics(tree[0]!)).toMatchObject({ runs: 4, totalTokens: 155, durationMs: 1550 });
  });

  it('counts descendants and finds nested tasks', () => {
    expect(countDescendants(tree[0]!)).toBe(3);
    expect(findNode(tree, 'qa-failed')?.agentId).toBe('qa');
  });

  it('does not treat drafts or queued tasks as active work', () => {
    const planned = [node('a', 'draft'), node('b', 'queued')];
    expect(collectActiveAgentIds(planned)).toEqual(new Set());
    expect(countTasks(planned)).toMatchObject({ total: 2, active: 0, planned: 2, queued: 1 });
  });

  it('counts tasks by status, subtasks included', () => {
    expect(countTasks(tree)).toEqual({ total: 5, active: 2, planned: 0, queued: 0, completed: 2, failed: 1 });
  });
});
