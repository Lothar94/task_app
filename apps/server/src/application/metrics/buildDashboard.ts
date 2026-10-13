import type {
  AgentUsageRow,
  DailyActivity,
  DashboardDto,
  DashboardFilters,
  DashboardTotals,
  ModelUsageRow,
  RunErrorRow,
} from '@fleet/shared';
import type { Agent } from '../../domain/agent/Agent.js';
import type { Project } from '../../domain/project/Project.js';
import type { Task } from '../../domain/task/Task.js';
import type { TaskRun } from '../../domain/task/TaskRun.js';
import { addTotals, EMPTY_TOTALS, runDurationMs, totalsOfModel, totalsOfRun } from './usageMath.js';

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
}

interface Scope {
  tasks: Task[];
  finishedTasks: Task[];
  runs: TaskRun[];
  taskById: Map<string, Task>;
  since: Date | null;
}

export function localDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const finishedAt = (task: Task) => task.toSnapshot().finishedAt;
const countStatus = (tasks: Task[], status: Task['status']) =>
  tasks.filter((task) => task.status === status).length;

function scopeOf({ tasks, runs, filters, now }: DashboardInput): Scope {
  const since = filters.days ? new Date(now.getTime() - filters.days * DAY_MS) : null;
  const inPeriod = (date: Date | null) => date !== null && (!since || date >= since);
  const scopedTasks = tasks.filter((task) => !filters.projectId || task.projectId === filters.projectId);
  const taskById = new Map(scopedTasks.map((task) => [task.id, task]));
  return {
    tasks: scopedTasks,
    finishedTasks: scopedTasks.filter((task) => task.isFinished && inPeriod(finishedAt(task))),
    runs: runs.filter((run) => taskById.has(run.taskId) && inPeriod(run.finishedAt)),
    taskById,
    since,
  };
}

function totalsOf(scope: Scope): DashboardTotals {
  const completed = countStatus(scope.finishedTasks, 'completed');
  const failed = countStatus(scope.finishedTasks, 'failed');
  return {
    ...scope.runs.map(totalsOfRun).reduce(addTotals, EMPTY_TOTALS),
    completed,
    failed,
    cancelled: countStatus(scope.finishedTasks, 'cancelled'),
    active: scope.tasks.filter((task) => task.isActive).length,
    successRate: completed + failed > 0 ? completed / (completed + failed) : null,
    runs: scope.runs.length,
    agentTimeMs: scope.runs.reduce((sum, run) => sum + runDurationMs(run), 0),
  };
}

function byModel(scope: Scope): ModelUsageRow[] {
  const rows = new Map<string, ModelUsageRow>();
  for (const run of scope.runs) {
    for (const usage of run.models) {
      const row = rows.get(usage.model) ?? { ...EMPTY_TOTALS, model: usage.model, runs: 0 };
      rows.set(usage.model, { ...addTotals(row, totalsOfModel(usage)), runs: row.runs + 1 });
    }
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
    if (agentId) rows.set(agentId, addTotals(rowFor(agentId), totalsOfRun(run)));
  }
  return [...rows.values()].sort((a, b) => b.totalTokens - a.totalTokens || b.completed - a.completed);
}

/** First day of the activity chart: the filter's window, or the first activity (at most 90 days back). */
function chartStart(scope: Scope, filters: DashboardFilters, now: Date): Date {
  const days = Math.min(filters.days ?? MAX_CHART_DAYS, MAX_CHART_DAYS);
  const windowStart = now.getTime() - (days - 1) * DAY_MS;
  if (filters.days) return new Date(windowStart);
  const activity = [
    ...scope.runs.map((run) => run.finishedAt.getTime()),
    ...scope.finishedTasks.map((task) => finishedAt(task)?.getTime() ?? now.getTime()),
  ];
  return new Date(Math.max(windowStart, Math.min(now.getTime(), ...activity)));
}

function daily(scope: Scope, filters: DashboardFilters, now: Date): DailyActivity[] {
  const days = new Map<string, DailyActivity>();
  for (
    let time = chartStart(scope, filters, now).getTime();
    time <= now.getTime() + DAY_MS / 2;
    time += DAY_MS
  ) {
    const date = localDateKey(new Date(time));
    days.set(date, { date, totalTokens: 0, completed: 0, failed: 0 });
  }
  for (const run of scope.runs) {
    const day = days.get(localDateKey(run.finishedAt));
    if (day) day.totalTokens += totalsOfRun(run).totalTokens;
  }
  for (const task of scope.finishedTasks) {
    const day = days.get(localDateKey(finishedAt(task) ?? now));
    if (day && (task.status === 'completed' || task.status === 'failed')) day[task.status] += 1;
  }
  return [...days.values()];
}

function errors(scope: Scope, agents: Agent[], projects: Project[]): RunErrorRow[] {
  return scope.runs
    .filter((run) => run.outcome === 'failed')
    .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime())
    .slice(0, MAX_ERRORS)
    .flatMap((run) => {
      const task = scope.taskById.get(run.taskId);
      if (!task) return [];
      return [
        {
          runId: run.id,
          taskId: task.id,
          taskNumber: task.number,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: projects.find((project) => project.id === task.projectId)?.toSnapshot().name ?? '?',
          agentName: agents.find((agent) => agent.id === task.agentId)?.name ?? 'Agente eliminado',
          error: run.error ?? 'Error desconocido',
          occurredAt: run.finishedAt.toISOString(),
        },
      ];
    });
}

/** Aggregates task outcomes and token usage for the usage dashboard. */
export function buildDashboard(input: DashboardInput): DashboardDto {
  const scope = scopeOf(input);
  return {
    filters: input.filters,
    totals: totalsOf(scope),
    byModel: byModel(scope),
    byAgent: byAgent(scope, input.agents),
    daily: daily(scope, input.filters, input.now),
    errors: errors(scope, input.agents, input.projects),
  };
}
