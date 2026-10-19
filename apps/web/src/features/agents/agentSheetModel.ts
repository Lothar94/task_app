import type { AgentDto, AgentUsageRow } from '@fleet/shared';

export interface AgentTrackRecord {
  completed: number;
  /** failed / (completed + failed); null when the agent has not finished any run. */
  failRate: number | null;
}

/** Orchestrators are the agents that delegate to others. */
export const isOrchestrator = (agent: Pick<AgentDto, 'collaboratorIds'>) => agent.collaboratorIds.length > 0;

/** Finished-task record of one agent from the dashboard rows; undefined when the agent never ran. */
export function agentTrackRecord(rows: AgentUsageRow[], agentId: string): AgentTrackRecord | undefined {
  const row = rows.find((item) => item.agentId === agentId);
  if (!row) return undefined;
  const finished = row.completed + row.failed;
  return { completed: row.completed, failRate: finished === 0 ? null : row.failed / finished };
}
