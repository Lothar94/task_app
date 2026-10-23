import type {
  ActiveDelegationDto,
  ActiveTaskRef,
  AgentActivityDto,
  AgentLiveStatusDto,
  TaskStatus,
} from '@fleet/shared';

const DELEGATED_STATUSES: readonly TaskStatus[] = ['pending', 'running', 'waiting_subtasks'];

export interface ActivityTask {
  id: string;
  projectId: string;
  number: number;
  title: string;
  agentId: string;
  parentTaskId: string | null;
  status: TaskStatus;
  startedAt: Date | null;
}

const toRef = ({ id, projectId, number, title }: ActivityTask): ActiveTaskRef => ({
  taskId: id,
  projectId,
  number,
  title,
});

/** Most recently started first; ties (or never started) by id so the result is deterministic. */
const latestStarted = (a: ActivityTask, b: ActivityTask) =>
  (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0) || a.id.localeCompare(b.id);

function liveStatusOf(agentId: string, tasks: readonly ActivityTask[]): AgentLiveStatusDto | null {
  const own = tasks.filter((task) => task.agentId === agentId);
  const running = own.filter((task) => task.status === 'running').sort(latestStarted);
  const waiting = own.filter((task) => task.status === 'waiting_subtasks').sort(latestStarted);
  const current = running[0] ?? waiting[0];
  if (!current) return null;
  return {
    agentId,
    state: running.length > 0 ? 'working' : 'delegating',
    currentTask: toRef(current),
    activeTasks: running.length + waiting.length,
  };
}

function delegationsOf(tasks: readonly ActivityTask[], agentIds: ReadonlySet<string>): ActiveDelegationDto[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return tasks
    .flatMap((subtask) => {
      const parent = subtask.parentTaskId ? byId.get(subtask.parentTaskId) : undefined;
      if (!parent || parent.status !== 'waiting_subtasks' || !DELEGATED_STATUSES.includes(subtask.status))
        return [];
      if (!agentIds.has(parent.agentId) || !agentIds.has(subtask.agentId)) return [];
      return [{ fromAgentId: parent.agentId, toAgentId: subtask.agentId, taskId: subtask.id }];
    })
    .sort(
      (a, b) =>
        a.fromAgentId.localeCompare(b.fromAgentId) ||
        a.toAgentId.localeCompare(b.toAgentId) ||
        a.taskId.localeCompare(b.taskId),
    );
}

/**
 * Live snapshot of an organization's agents: only those with work in progress and the delegations in
 * flight, both sorted by ids so equal states give equal snapshots. `tasks` are the organization's
 * tasks in any status; tasks of agents not in `agents` are ignored.
 */
export function buildAgentActivity(
  organizationId: string,
  agents: readonly { id: string }[],
  tasks: readonly ActivityTask[],
  now: Date,
): AgentActivityDto {
  return {
    organizationId,
    agents: agents
      .map((agent) => agent.id)
      .sort((a, b) => a.localeCompare(b))
      .flatMap((agentId) => liveStatusOf(agentId, tasks) ?? []),
    delegations: delegationsOf(tasks, new Set(agents.map((agent) => agent.id))),
    generatedAt: now.toISOString(),
  };
}
