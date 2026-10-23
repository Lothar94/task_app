import type { AgentActivityDto, AgentLiveStatusDto } from '@fleet/shared';

/** The most recent of two snapshots, so a late REST answer never hides a newer SSE one. */
export function newestActivity(
  next: AgentActivityDto,
  current: AgentActivityDto | undefined,
): AgentActivityDto {
  return current && current.generatedAt > next.generatedAt ? current : next;
}

export const liveStatusById = (activity: AgentActivityDto | undefined) =>
  new Map<string, AgentLiveStatusDto>((activity?.agents ?? []).map((status) => [status.agentId, status]));

/** Keys `from→to` of the delegations in progress. */
export const delegationKeys = (activity: AgentActivityDto | undefined) =>
  new Set(
    (activity?.delegations ?? []).map((delegation) => `${delegation.fromAgentId}→${delegation.toAgentId}`),
  );

export const activeAgentsLabel = (count: number) => `${count} ${count === 1 ? 'activo' : 'activos'}`;
