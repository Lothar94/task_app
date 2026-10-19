import type { TaskNodeDto } from '@fleet/shared';
import { collectActiveAgentIds, countTasks, subtreeMetrics, type TaskCounts } from '../tasks/taskTreeModel';

export type ProjectStatus = 'running' | 'attention' | 'idle';

export interface TreeTotals {
  tokens: number;
  costUsd: number;
  workingMs: number;
}

export interface ProjectTelemetry extends TreeTotals {
  counts: TaskCounts;
  /** completed / (completed + failed); null when nothing finished yet. */
  successRate: number | null;
  /** Share of all tasks that are completed or failed, as 0–100 each, for the progress bar. */
  completedPercent: number;
  failedPercent: number;
  activeAgents: number;
  /** Most recent task timestamp (created, started or finished), if there is any task. */
  lastActivityAt: string | null;
  status: ProjectStatus;
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

/** Failed tasks need attention; otherwise a project with active tasks is running. */
export function projectStatus(counts: TaskCounts): ProjectStatus {
  if (counts.failed > 0) return 'attention';
  return counts.active > 0 ? 'running' : 'idle';
}

function latestTimestamp(nodes: TaskNodeDto[]): string | null {
  let latest: string | null = null;
  const visit = (node: TaskNodeDto) => {
    for (const stamp of [node.createdAt, node.startedAt, node.finishedAt]) {
      if (stamp && (latest === null || stamp > latest)) latest = stamp;
    }
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return latest;
}

const percentOf = (part: number, total: number) => (total === 0 ? 0 : (part / total) * 100);

export function projectTelemetry(nodes: TaskNodeDto[]): ProjectTelemetry {
  const counts = countTasks(nodes);
  const finished = counts.completed + counts.failed;
  return {
    ...treeTotals(nodes),
    counts,
    successRate: finished === 0 ? null : counts.completed / finished,
    completedPercent: percentOf(counts.completed, counts.total),
    failedPercent: percentOf(counts.failed, counts.total),
    activeAgents: collectActiveAgentIds(nodes).size,
    lastActivityAt: latestTimestamp(nodes),
    status: projectStatus(counts),
  };
}

export interface PortfolioTelemetry {
  activeTasks: number;
  totalTasks: number;
  completedTasks: number;
  tokens: number;
  costUsd: number;
}

export function portfolioTelemetry(items: ProjectTelemetry[]): PortfolioTelemetry {
  return items.reduce<PortfolioTelemetry>(
    (sum, item) => ({
      activeTasks: sum.activeTasks + item.counts.active,
      totalTasks: sum.totalTasks + item.counts.total,
      completedTasks: sum.completedTasks + item.counts.completed,
      tokens: sum.tokens + item.tokens,
      costUsd: sum.costUsd + item.costUsd,
    }),
    { activeTasks: 0, totalTasks: 0, completedTasks: 0, tokens: 0, costUsd: 0 },
  );
}
