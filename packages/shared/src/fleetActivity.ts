/**
 * Live state of an organization's agents for the org chart.
 *
 * GET /api/organizations/:id/agent-activity → AgentActivityDto (404 when the organization does not
 * exist). Afterwards the same snapshot arrives through SSE as `agent.activity` events.
 */
export const AGENT_LIVE_STATES = [
  /** Has at least one task running. */
  'working',
  /** Has no task running but waits for subtasks it delegated. */
  'delegating',
  'idle',
] as const;
export type AgentLiveState = (typeof AGENT_LIVE_STATES)[number];

export interface ActiveTaskRef {
  taskId: string;
  projectId: string;
  number: number;
  title: string;
}

export interface AgentLiveStatusDto {
  agentId: string;
  state: Exclude<AgentLiveState, 'idle'>;
  /** Running task started most recently; the waiting one when the agent is only delegating. */
  currentTask: ActiveTaskRef;
  /** Tasks of the agent running or waiting for subtasks. */
  activeTasks: number;
}

/** A delegation in progress: `toAgentId` works on a subtask of a task of `fromAgentId`. */
export interface ActiveDelegationDto {
  fromAgentId: string;
  toAgentId: string;
  /** The subtask (pending, running or waiting for its own subtasks). */
  taskId: string;
}

export interface AgentActivityDto {
  organizationId: string;
  /** Only agents with work in progress; agents not listed are idle. */
  agents: AgentLiveStatusDto[];
  delegations: ActiveDelegationDto[];
  generatedAt: string;
}

/**
 * Spending against the monthly limit.
 *
 * GET /api/organizations/:id/budget → BudgetDto (404 when the organization does not exist).
 */
export interface BudgetDto {
  /** Current calendar month in UTC, `YYYY-MM`. */
  month: string;
  /** Estimated cost (same price table as the dashboard) of the organization's runs this month. */
  monthToDateCostUsd: number;
  /** From the MONTHLY_BUDGET_USD setting; null when no limit is configured. */
  monthlyLimitUsd: number | null;
}
