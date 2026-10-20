import type {
  ActiveSubtaskDto,
  ProjectAlertDto,
  ProjectOperationalStatus,
  ProjectTaskCounts,
  ProjectTelemetryDto,
  ProjectsSummaryDto,
  ProjectsTelemetryDto,
} from '@fleet/shared';
import { PROJECT_ALERT_KINDS } from '@fleet/shared';
import type { Agent } from '../../domain/agent/Agent.js';
import type { Project } from '../../domain/project/Project.js';
import type { Task } from '../../domain/task/Task.js';
import type { TaskRun } from '../../domain/task/TaskRun.js';
import { groupBy, summarizeRuns } from '../metrics/usageMath.js';
import { classifyFailure, recoverableFailures } from './classifyFailure.js';

const WEEK_MS = 7 * 86_400_000;

export interface ProjectsTelemetryInput {
  tasks: Task[];
  runs: TaskRun[];
  agents: Agent[];
  /** Same order as the response. */
  projects: Project[];
  now: Date;
}

const countStatus = (tasks: Task[], status: Task['status']) =>
  tasks.filter((task) => task.status === status).length;

function countTasks(tasks: Task[]): ProjectTaskCounts {
  return {
    total: tasks.length,
    completed: countStatus(tasks, 'completed'),
    active: tasks.filter((task) => task.isActive).length,
    failed: countStatus(tasks, 'failed'),
    cancelled: countStatus(tasks, 'cancelled'),
    planned: tasks.filter((task) => task.isPlanned).length,
  };
}

function buildAlerts(tasks: Task[]): ProjectAlertDto[] {
  const recoverable = recoverableFailures(tasks);
  return PROJECT_ALERT_KINDS.flatMap((kind) => {
    const taskIds = recoverable
      .filter((task) => classifyFailure(task.resultSummary) === kind)
      .map((task) => task.id);
    return taskIds.length > 0 ? [{ kind, taskIds }] : [];
  });
}

function pickActiveSubtask(tasks: Task[], agentNames: Map<string, string>): ActiveSubtaskDto | null {
  const running = tasks
    .filter((task) => task.status === 'running' && task.toSnapshot().startedAt)
    .sort((a, b) => {
      const byStart = b.toSnapshot().startedAt!.getTime() - a.toSnapshot().startedAt!.getTime();
      return byStart || b.number - a.number;
    })[0];
  if (!running) return null;
  return {
    taskId: running.id,
    taskNumber: running.number,
    title: running.title,
    agentId: running.agentId,
    agentName: agentNames.get(running.agentId) ?? running.agentId,
    startedAt: running.toSnapshot().startedAt!.toISOString(),
  };
}

function lastActivity(tasks: Task[], runs: TaskRun[]): string | null {
  const times = [
    ...tasks.flatMap((task) => {
      const { createdAt, startedAt, finishedAt } = task.toSnapshot();
      return [createdAt, startedAt, finishedAt];
    }),
    ...runs.map((run) => run.finishedAt),
  ].flatMap((date) => (date ? [date.getTime()] : []));
  if (times.length === 0) return null;
  return new Date(times.reduce((latest, time) => Math.max(latest, time))).toISOString();
}

function statusOf(tasks: Task[], alerts: ProjectAlertDto[]): ProjectOperationalStatus {
  if (alerts.length > 0) return 'attention';
  if (tasks.some((task) => task.isActive)) return 'running';
  if (tasks.some((task) => task.isPlanned)) return 'resting';
  return 'idle';
}

function buildProject(
  project: Project,
  tasks: Task[],
  runsByTask: Map<string, TaskRun[]>,
  agentNames: Map<string, string>,
): ProjectTelemetryDto {
  const runs = tasks.flatMap((task) => runsByTask.get(task.id) ?? []);
  const counts = countTasks(tasks);
  const alerts = buildAlerts(tasks);
  const metrics = summarizeRuns(runs);
  const finished = counts.completed + counts.failed;
  return {
    projectId: project.id,
    status: statusOf(tasks, alerts),
    counts,
    successRate: finished > 0 ? counts.completed / finished : null,
    totalTokens: metrics.totalTokens,
    costUsd: metrics.costUsd,
    agentTimeMs: metrics.durationMs,
    lastActivityAt: lastActivity(tasks, runs),
    activeAgentIds: [...new Set(tasks.filter((task) => task.isActive).map((task) => task.agentId))],
    activeSubtask: pickActiveSubtask(tasks, agentNames),
    alerts,
  };
}

function weeklyDelta(projects: Project[], now: Date): number {
  const since = now.getTime() - WEEK_MS;
  const recent = (date: Date | null) => date !== null && date.getTime() >= since;
  const created = projects.filter((project) => !project.isArchived && recent(project.toSnapshot().createdAt));
  const archived = projects.filter((project) => recent(project.toSnapshot().archivedAt));
  return created.length - archived.length;
}

function buildSummary(projects: Project[], telemetry: ProjectTelemetryDto[], now: Date): ProjectsSummaryDto {
  const activeIds = new Set(projects.filter((project) => !project.isArchived).map((project) => project.id));
  const active = telemetry.filter((entry) => activeIds.has(entry.projectId));
  const sum = (pick: (entry: ProjectTelemetryDto) => number) =>
    active.reduce((total, entry) => total + pick(entry), 0);
  return {
    activeProjects: activeIds.size,
    activeProjectsWeeklyDelta: weeklyDelta(projects, now),
    activeTasks: sum((entry) => entry.counts.active),
    totalTasks: sum((entry) => entry.counts.total),
    completedTasks: sum((entry) => entry.counts.completed),
    swarmAgentIds: [
      ...new Set(projects.filter((project) => activeIds.has(project.id)).flatMap((p) => p.memberIds)),
    ],
    totalTokens: sum((entry) => entry.totalTokens),
    costUsd: sum((entry) => entry.costUsd),
  };
}

export function buildProjectsTelemetry(input: ProjectsTelemetryInput): ProjectsTelemetryDto {
  const { tasks, runs, agents, projects, now } = input;
  const tasksByProject = groupBy(tasks, (task) => task.projectId);
  const runsByTask = groupBy(runs, (run) => run.taskId);
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
  const telemetry = projects.map((project) =>
    buildProject(project, tasksByProject.get(project.id) ?? [], runsByTask, agentNames),
  );
  return {
    generatedAt: now.toISOString(),
    summary: buildSummary(projects, telemetry, now),
    projects: telemetry,
  };
}
