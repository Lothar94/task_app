import {
  RUN_ERROR_CAUSES,
  type AgentUsageRow,
  type DailyActivity,
  type DashboardDto,
  type DashboardFilters,
  type DashboardTotals,
  type ModelUsageRow,
  type RunErrorCause,
  type RunErrorCauseCount,
  type RunErrorRow,
} from '@fleet/shared';
import type { Agent } from '../../domain/agent/Agent.js';
import type { Project } from '../../domain/project/Project.js';
import type { Task } from '../../domain/task/Task.js';
import type { TaskRun } from '../../domain/task/TaskRun.js';
import { dailyBuckets, hourlyBuckets, type ActivityBuckets } from './activityBuckets.js';
import { classifyRunError } from './classifyRunError.js';
import { addCost, ZERO_COST, type ModelPriceTable } from './ModelPriceTable.js';
import {
  addTotals,
  EMPTY_TOTALS,
  estimatedTotalsOfRun,
  runDurationMs,
  totalsOfModel,
  totalsOfRun,
} from './usageMath.js';

const DAY_MS = 86_400_000;
const MAX_CHART_DAYS = 90;
const MAX_ERRORS = 50;

export interface DashboardInput {
  tasks: Task[];
  runs: TaskRun[];
  agents: Agent[];
  projects: Project[];
  filters: DashboardFilters;
  now: Date;
  prices: ModelPriceTable;
}

/** Activity finished at or after `from` and before `to`; null leaves that side open. */
interface Window {
  from: Date | null;
  to: Date | null;
}

interface Scope {
  tasks: Task[];
  finishedTasks: Task[];
  runs: TaskRun[];
  taskById: Map<string, Task>;
  prices: ModelPriceTable;
}

const finishedAt = (task: Task) => task.toSnapshot().finishedAt;
const countStatus = (tasks: Task[], status: Task['status']) =>
  tasks.filter((task) => task.status === status).length;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function periodOf({ days }: DashboardFilters, now: Date): Window {
  return { from: days ? new Date(now.getTime() - days * DAY_MS) : null, to: null };
}

/** The window of the same length right before the period; null for all time. */
function previousPeriodOf({ days }: DashboardFilters, now: Date): Window | null {
  if (!days) return null;
  return { from: new Date(now.getTime() - 2 * days * DAY_MS), to: new Date(now.getTime() - days * DAY_MS) };
}

function scopeOf({ tasks, runs, filters, prices }: DashboardInput, { from, to }: Window): Scope {
  const inWindow = (date: Date | null) => date !== null && (!from || date >= from) && (!to || date < to);
  const scopedTasks = tasks.filter((task) => !filters.projectId || task.projectId === filters.projectId);
  const taskById = new Map(scopedTasks.map((task) => [task.id, task]));
  return {
    tasks: scopedTasks,
    finishedTasks: scopedTasks.filter((task) => task.isFinished && inWindow(finishedAt(task))),
    runs: runs.filter((run) => taskById.has(run.taskId) && inWindow(run.finishedAt)),
    taskById,
    prices,
  };
}

function totalsOf(scope: Scope): DashboardTotals {
  const completed = countStatus(scope.finishedTasks, 'completed');
  const failed = countStatus(scope.finishedTasks, 'failed');
  const usages = scope.runs.flatMap((run) => run.models);
  return {
    ...scope.runs.map((run) => estimatedTotalsOfRun(run, scope.prices)).reduce(addTotals, EMPTY_TOTALS),
    completed,
    failed,
    cancelled: countStatus(scope.finishedTasks, 'cancelled'),
    active: scope.tasks.filter((task) => task.isActive).length,
    successRate: completed + failed > 0 ? completed / (completed + failed) : null,
    runs: scope.runs.length,
    agentTimeMs: sum(scope.runs.map(runDurationMs)),
    tasksRun: new Set(scope.runs.map((run) => run.taskId)).size,
    cacheSavingsUsd: sum(usages.map((usage) => scope.prices.estimate(usage).cacheSavingsUsd)),
  };
}

function byModel(scope: Scope): ModelUsageRow[] {
  const rows = new Map<string, ModelUsageRow>();
  for (const usage of scope.runs.flatMap((run) => run.models)) {
    const estimate = scope.prices.estimate(usage);
    const row = rows.get(usage.model) ?? {
      ...EMPTY_TOTALS,
      model: usage.model,
      runs: 0,
      pricing: estimate.pricing,
      cost: ZERO_COST,
      cacheSavingsUsd: 0,
    };
    rows.set(usage.model, {
      ...addTotals(row, { ...totalsOfModel(usage), costUsd: estimate.costUsd }),
      runs: row.runs + 1,
      cost: addCost(row.cost, estimate.cost),
      cacheSavingsUsd: row.cacheSavingsUsd + estimate.cacheSavingsUsd,
    });
  }
  return [...rows.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function byAgent(scope: Scope, agents: Agent[]): AgentUsageRow[] {
  const rows = new Map<string, AgentUsageRow>();
  const rowFor = (agentId: string) => {
    const name = agents.find((agent) => agent.id === agentId)?.name ?? 'Agente eliminado';
    const row = rows.get(agentId) ?? {
      ...EMPTY_TOTALS,
      agentId,
      agentName: name,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    rows.set(agentId, row);
    return row;
  };
  for (const task of scope.finishedTasks) {
    const row = rowFor(task.agentId);
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled')
      row[task.status] += 1;
  }
  for (const run of scope.runs) {
    const agentId = scope.taskById.get(run.taskId)?.agentId;
    if (agentId) rows.set(agentId, addTotals(rowFor(agentId), estimatedTotalsOfRun(run, scope.prices)));
  }
  return [...rows.values()].sort((a, b) => b.totalTokens - a.totalTokens || b.completed - a.completed);
}

/** First day of the activity chart: the whole filtered period, or the first activity (at most 90 days back). */
function chartStart(scope: Scope, filters: DashboardFilters, now: Date): Date {
  if (filters.days) return new Date(now.getTime() - (filters.days - 1) * DAY_MS);
  const activity = [
    ...scope.runs.map((run) => run.finishedAt.getTime()),
    ...scope.finishedTasks.map((task) => finishedAt(task)?.getTime() ?? now.getTime()),
  ];
  const oldest = now.getTime() - (MAX_CHART_DAYS - 1) * DAY_MS;
  return new Date(Math.max(oldest, Math.min(now.getTime(), ...activity)));
}

function activityBucketsOf(scope: Scope, filters: DashboardFilters, now: Date): ActivityBuckets {
  return filters.days === 1 ? hourlyBuckets(now) : dailyBuckets(chartStart(scope, filters, now), now);
}

function activity(scope: Scope, { keys, keyOf }: ActivityBuckets, now: Date): DailyActivity[] {
  const buckets = new Map(keys.map((date) => [date, { date, totalTokens: 0, completed: 0, failed: 0 }]));
  for (const run of scope.runs) {
    const bucket = buckets.get(keyOf(run.finishedAt));
    if (bucket) bucket.totalTokens += totalsOfRun(run).totalTokens;
  }
  for (const task of scope.finishedTasks) {
    const bucket = buckets.get(keyOf(finishedAt(task) ?? now));
    if (bucket && (task.status === 'completed' || task.status === 'failed')) bucket[task.status] += 1;
  }
  return [...buckets.values()];
}

const failedRunsOf = (scope: Scope) =>
  scope.runs
    .filter((run) => run.outcome === 'failed')
    .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());

/** A failed top-level task of an active project can be re-queued from the dashboard. */
const isRetryable = (task: Task, project: Project | undefined) =>
  task.status === 'failed' && task.parentTaskId === null && project !== undefined && !project.isArchived;

function errorRows(failedRuns: TaskRun[], scope: Scope, agents: Agent[], projects: Project[]): RunErrorRow[] {
  return failedRuns.slice(0, MAX_ERRORS).flatMap((run) => {
    const task = scope.taskById.get(run.taskId);
    if (!task) return [];
    const project = projects.find((candidate) => candidate.id === task.projectId);
    return [
      {
        runId: run.id,
        taskId: task.id,
        taskNumber: task.number,
        taskTitle: task.title,
        projectId: task.projectId,
        projectName: project?.toSnapshot().name ?? '?',
        agentName: agents.find((agent) => agent.id === task.agentId)?.name ?? 'Agente eliminado',
        error: run.error ?? 'Error desconocido',
        cause: classifyRunError(run.error),
        retryable: isRetryable(task, project),
        occurredAt: run.finishedAt.toISOString(),
      },
    ];
  });
}

/** Most frequent first; ties keep the order of RUN_ERROR_CAUSES. */
function errorCauses(failedRuns: TaskRun[]): RunErrorCauseCount[] {
  const counts = new Map<RunErrorCause, number>();
  for (const run of failedRuns) {
    const cause = classifyRunError(run.error);
    counts.set(cause, (counts.get(cause) ?? 0) + 1);
  }
  return RUN_ERROR_CAUSES.flatMap((cause) => {
    const count = counts.get(cause) ?? 0;
    return count > 0 ? [{ cause, count }] : [];
  }).sort((a, b) => b.count - a.count);
}

/** Aggregates task outcomes, token usage and estimated costs for the usage dashboard. */
export function buildDashboard(input: DashboardInput): DashboardDto {
  const { filters, now, agents, projects } = input;
  const scope = scopeOf(input, periodOf(filters, now));
  const previousPeriod = previousPeriodOf(filters, now);
  const buckets = activityBucketsOf(scope, filters, now);
  const failedRuns = failedRunsOf(scope);
  return {
    filters,
    totals: totalsOf(scope),
    previous: previousPeriod ? totalsOf(scopeOf(input, previousPeriod)) : null,
    byModel: byModel(scope),
    byAgent: byAgent(scope, agents),
    activityGranularity: buckets.granularity,
    daily: activity(scope, buckets, now),
    errors: errorRows(failedRuns, scope, agents, projects),
    errorsTotal: failedRuns.length,
    errorCauses: errorCauses(failedRuns),
  };
}
