import type { DashboardTotals } from '@fleet/shared';
import { Banknote, CircleAlert, CircleCheck, Clock, Cpu, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatTile } from '../../components/StatTile';
import { formatCost, formatDuration, formatInteger, formatPercent, formatTokens } from '../../lib/format';
import { averageRunMs, cacheShare, errorRate } from './dashboardModel';

/** Mono key/value row for the tile footer; rendered only when the value exists. */
function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="text-fg-muted">{value}</span>
    </p>
  );
}

function SuccessBar({ rate }: { rate: number | null }) {
  return (
    <div className="space-y-1.5">
      <div
        role="img"
        aria-label={`Tasa de éxito ${formatPercent(rate)}`}
        className="h-1.5 w-full bg-surface-hover"
      >
        <div className="h-full bg-[var(--status-good)]" style={{ width: `${(rate ?? 0) * 100}%` }} />
      </div>
      <p>completadas / (completadas + fallidas)</p>
    </div>
  );
}

export function Headline({ totals }: { totals: DashboardTotals }) {
  const failRate = errorRate(totals);
  const cache = cacheShare(totals);
  const perRun = averageRunMs(totals);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile
        label="Resueltas"
        value={totals.completed}
        tone="good"
        icon={<CircleCheck />}
        detail={`${totals.active} en curso ahora`}
        footer={<Metric label="Ejecuciones" value={formatInteger(totals.runs)} />}
      />
      <StatTile
        label="Fallidas"
        value={totals.failed}
        tone="critical"
        icon={<CircleAlert />}
        detail={`${totals.cancelled} canceladas`}
        footer={failRate !== null && <Metric label="Tasa de error" value={formatPercent(failRate)} />}
      />
      <StatTile
        label="Tasa de éxito"
        icon={<ShieldCheck />}
        value={formatPercent(totals.successRate)}
        detail={<SuccessBar rate={totals.successRate} />}
      />
      <StatTile
        label="Tokens"
        icon={<Cpu />}
        value={formatTokens(totals.totalTokens)}
        detail={`${formatTokens(totals.outputTokens)} de salida`}
        footer={cache !== null && <Metric label="Lectura de caché" value={formatPercent(cache)} />}
      />
      <StatTile
        label="Coste estimado"
        icon={<Banknote />}
        value={formatCost(totals.costUsd)}
        detail="según tarifas de la API; tu suscripción no lo cobra"
      />
      <StatTile
        label="Tiempo de agentes"
        icon={<Clock />}
        value={formatDuration(totals.agentTimeMs)}
        detail={`${totals.runs} ejecuciones`}
        footer={perRun !== null && <Metric label="Promedio/ejecución" value={formatDuration(perRun)} />}
      />
    </div>
  );
}
