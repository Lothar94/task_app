import { StatTile } from '../../components/StatTile';
import { formatCost, formatInteger, formatPercent, formatTokens } from '../../lib/format';
import { useDashboard } from '../dashboard/dashboardQueries';

/** Fleet-wide totals from the dashboard; renders nothing while loading, on error or without activity. */
export function FleetTiles() {
  const { data } = useDashboard({ projectId: null, days: null });
  if (!data || data.totals.runs === 0) return null;
  const { totals } = data;
  return (
    <section aria-label="Totales de la flota" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile label="Tokens totales" value={formatTokens(totals.totalTokens)} />
      <StatTile label="Coste acumulado" value={formatCost(totals.costUsd)} unit="USD" detail="estimación" />
      <StatTile
        label="Tareas ejecutadas"
        value={formatInteger(totals.completed)}
        unit="completadas"
        detail={totals.successRate !== null && `${formatPercent(totals.successRate)} éxito global`}
        tone={totals.failed > 0 ? 'warning' : 'good'}
      />
    </section>
  );
}
