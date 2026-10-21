import type { FleetNodeDto, FleetStatusDto, TaskStatus } from '@fleet/shared';

const ACTIVE_STATUSES: readonly TaskStatus[] = ['running', 'waiting_subtasks'];

export const isFleetActiveStatus = (status: TaskStatus): boolean => ACTIVE_STATUSES.includes(status);

export interface FleetStatusInput {
  agents: readonly { id: string; name: string }[];
  /** Tasks of the organization, in any status. */
  tasks: readonly { agentId: string; status: TaskStatus }[];
  version: string;
  now: Date;
}

export function buildFleetStatus({ agents, tasks, version, now }: FleetStatusInput): FleetStatusDto {
  const activeTasks = tasks.filter((task) => isFleetActiveStatus(task.status));
  const loadByAgent = new Map<string, number>();
  for (const task of activeTasks) loadByAgent.set(task.agentId, (loadByAgent.get(task.agentId) ?? 0) + 1);

  const activeNodes: FleetNodeDto[] = agents
    .filter((agent) => loadByAgent.has(agent.id))
    .map((agent) => ({ agentId: agent.id, name: agent.name, activeTasks: loadByAgent.get(agent.id) ?? 0 }))
    .sort((a, b) => b.activeTasks - a.activeTasks || a.name.localeCompare(b.name));

  return {
    state: activeTasks.length > 0 ? 'active' : 'idle',
    activeNodes,
    totalAgents: agents.length,
    activeTasks: activeTasks.length,
    version,
    generatedAt: now.toISOString(),
  };
}
