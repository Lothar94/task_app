import type { AgentDto, BudgetDto, DashboardDto } from '@fleet/shared';
import { StatTile } from '../../components/StatTile';
import { formatCost, formatInteger, formatPercent, formatTokens } from '../../lib/format';
import { useBudget, useDashboard } from '../dashboard/dashboardQueries';
import { budgetUsage, mcpServersInUse, namesSummary } from './fleetTilesModel';

function TokensTile({ day }: { day: DashboardDto }) {
  return <StatTile label="Total tokens (24h)" value={formatTokens(day.totals.totalTokens)} />;
}

const BUDGET_TONES = { ok: 'default', near: 'warning', over: 'critical' } as const;

function budgetDetail(budget: BudgetDto) {
  const usage = budgetUsage(budget);
  if (!usage || budget.monthlyLimitUsd === null) return 'este mes';
  const limit = `Límite mensual: ${formatCost(budget.monthlyLimitUsd)}`;
  if (usage.level === 'over') return `${limit} · superado`;
  return usage.level === 'near' ? `${limit} · ${formatPercent(usage.ratio)} usado` : limit;
}

function CostTile({ budget }: { budget: BudgetDto }) {
  const usage = budgetUsage(budget);
  return (
    <StatTile
      label="Coste acumulado"
      value={formatCost(budget.monthToDateCostUsd)}
      unit="USD"
      detail={budgetDetail(budget)}
      tone={BUDGET_TONES[usage?.level ?? 'ok']}
    />
  );
}

function TasksTile({ all }: { all: DashboardDto }) {
  const { totals } = all;
  return (
    <StatTile
      label="Tareas ejecutadas"
      value={formatInteger(totals.completed)}
      unit="completadas"
      detail={totals.successRate !== null && `${formatPercent(totals.successRate)} éxito global`}
      tone={totals.runs === 0 ? 'default' : totals.failed > 0 ? 'warning' : 'good'}
    />
  );
}

function McpTile({ agents }: { agents: AgentDto[] }) {
  const servers = mcpServersInUse(agents);
  return (
    <StatTile
      label="Herramientas MCP"
      value={formatInteger(servers.length)}
      unit="en uso"
      detail={servers.length > 0 ? namesSummary(servers) : 'Ningún agente activo usa MCP'}
    />
  );
}

/**
 * Fleet-wide figures. Each tile appears once its own data is loaded (the MCP one comes from the
 * agents, always at hand), so a fleet without runs still shows its budget and MCP servers.
 */
export function FleetTiles({ agents }: { agents: AgentDto[] }) {
  const day = useDashboard({ projectId: null, days: 1 }).data;
  const all = useDashboard({ projectId: null, days: null }).data;
  const budget = useBudget().data;
  return (
    <section
      aria-label="Totales de la flota"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {day && <TokensTile day={day} />}
      {budget && <CostTile budget={budget} />}
      {all && <TasksTile all={all} />}
      <McpTile agents={agents} />
    </section>
  );
}
