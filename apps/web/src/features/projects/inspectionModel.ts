import type { AgentDto, ProjectDto, TaskNodeDto } from '@fleet/shared';
import { isTaskActive } from '../tasks/TaskStatusBadge';
import type { TreeTotals } from '../tasks/taskTreeModel';

export const RECENT_ROOTS_LIMIT = 3;
const MS_PER_MINUTE = 60_000;

export type AgentState = 'trabajando' | 'idle';

export interface TopologyRow {
  id: string;
  name: string;
  role: string;
  model: string;
  state: AgentState;
  isOrchestrator: boolean;
  /** Names of the collaborators that belong to the same member set. */
  delegatesTo: string[];
}

/** The inspected project: the one in the URL, else the first visible one. */
export function resolveInspected(projects: ProjectDto[], inspectId: string | null): ProjectDto | null {
  return projects.find((project) => project.id === inspectId) ?? projects[0] ?? null;
}

/** Most recent root tasks first; the task number breaks creation-time ties. */
export function recentRoots(tree: TaskNodeDto[], limit = RECENT_ROOTS_LIMIT): TaskNodeDto[] {
  return [...tree]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number)
    .slice(0, limit);
}

/** Elapsed run time: live while active, fixed once finished, null if it never started. */
export function taskElapsedMs(
  task: Pick<TaskNodeDto, 'status' | 'startedAt' | 'finishedAt'>,
  now: number,
): number | null {
  if (!task.startedAt) return null;
  const start = Date.parse(task.startedAt);
  if (isTaskActive(task.status)) return Math.max(0, now - start);
  return task.finishedAt ? Math.max(0, Date.parse(task.finishedAt) - start) : null;
}

/** Agent of the latest member root task; else the member nobody delegates to; else the first member. */
export function findOrchestrator(members: AgentDto[], tree: TaskNodeDto[]): AgentDto | null {
  if (members.length === 0) return null;
  const memberById = new Map(members.map((member) => [member.id, member]));
  for (const root of recentRoots(tree, tree.length)) {
    const owner = memberById.get(root.agentId);
    if (owner) return owner;
  }
  const delegated = new Set(members.flatMap((member) => member.collaboratorIds));
  const heads = members.filter((member) => !delegated.has(member.id));
  return [...heads].sort((a, b) => a.name.localeCompare(b.name))[0] ?? members[0];
}

export function topologyRows(
  members: AgentDto[],
  orchestratorId: string | null,
  workingIds: Set<string>,
): TopologyRow[] {
  const nameById = new Map(members.map((member) => [member.id, member.name]));
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    model: member.model,
    state: workingIds.has(member.id) ? 'trabajando' : 'idle',
    isOrchestrator: member.id === orchestratorId,
    delegatesTo: member.collaboratorIds.flatMap((id) => nameById.get(id) ?? []),
  }));
}

/** Average throughput over agent working time, or null without working time. */
export function tokensPerMinute(totals: TreeTotals): number | null {
  return totals.workingMs > 0 ? totals.tokens / (totals.workingMs / MS_PER_MINUTE) : null;
}
