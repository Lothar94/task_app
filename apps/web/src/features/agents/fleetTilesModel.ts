import type { AgentDto, BudgetDto } from '@fleet/shared';

/** Share of the monthly limit from which the cost tile warns. */
export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetLevel = 'ok' | 'near' | 'over';

/** Month-to-date spending against the limit; null when no limit is configured. */
export function budgetUsage(budget: BudgetDto): { ratio: number; level: BudgetLevel } | null {
  const limit = budget.monthlyLimitUsd;
  if (limit === null) return null;
  const ratio = limit > 0 ? budget.monthToDateCostUsd / limit : 1;
  const level = ratio >= 1 ? 'over' : ratio >= BUDGET_WARNING_RATIO ? 'near' : 'ok';
  return { ratio, level };
}

/** Distinct MCP servers given to enabled agents, sorted by name. */
export const mcpServersInUse = (agents: AgentDto[]) =>
  [
    ...new Set(agents.filter((agent) => agent.enabled !== false).flatMap((agent) => agent.mcpServers ?? [])),
  ].sort((a, b) => a.localeCompare(b));

/** "a + b + c" and "+N" for the rest. */
export function namesSummary(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(' + ');
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}
