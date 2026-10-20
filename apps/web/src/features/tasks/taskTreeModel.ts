import type { TaskMetricsDto, TaskNodeDto } from '@fleet/shared';
import { isTaskActive } from './TaskStatusBadge';

/** Ids of the agents currently working on any task of the tree. */
export function collectActiveAgentIds(nodes: TaskNodeDto[]): Set<string> {
  const active = new Set<string>();
  const visit = (node: TaskNodeDto) => {
    if (isTaskActive(node.status)) active.add(node.agentId);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return active;
}

function addMetrics(a: TaskMetricsDto, b: TaskMetricsDto): TaskMetricsDto {
  return {
    runs: a.runs + b.runs,
    durationMs: a.durationMs + b.durationMs,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

/** Metrics of a task plus everything it delegated, at any depth. */
export function subtreeMetrics(node: TaskNodeDto): TaskMetricsDto {
  return node.children.map(subtreeMetrics).reduce(addMetrics, node.metrics);
}

export interface TreeTotals {
  tokens: number;
  costUsd: number;
  workingMs: number;
}

/** Tokens, estimated cost and agent working time of a whole task tree. */
export function treeTotals(nodes: TaskNodeDto[]): TreeTotals {
  return nodes.map(subtreeMetrics).reduce<TreeTotals>(
    (sum, item) => ({
      tokens: sum.tokens + item.totalTokens,
      costUsd: sum.costUsd + item.costUsd,
      workingMs: sum.workingMs + item.durationMs,
    }),
    { tokens: 0, costUsd: 0, workingMs: 0 },
  );
}

export function countDescendants(node: TaskNodeDto): number {
  return node.children.reduce((count, child) => count + 1 + countDescendants(child), 0);
}

export function findNode(nodes: TaskNodeDto[], id: string): TaskNodeDto | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export interface TaskCounts {
  total: number;
  active: number;
  /** Root tasks waiting to be started: drafts and queued. */
  planned: number;
  queued: number;
  completed: number;
  failed: number;
}

/** Status counts of every task in the tree, subtasks included. */
export function countTasks(nodes: TaskNodeDto[]): TaskCounts {
  const counts: TaskCounts = { total: 0, active: 0, planned: 0, queued: 0, completed: 0, failed: 0 };
  const visit = (node: TaskNodeDto) => {
    counts.total += 1;
    if (isTaskActive(node.status)) counts.active += 1;
    if (node.status === 'draft' || node.status === 'queued') counts.planned += 1;
    if (node.status === 'queued') counts.queued += 1;
    if (node.status === 'completed') counts.completed += 1;
    if (node.status === 'failed') counts.failed += 1;
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return counts;
}
