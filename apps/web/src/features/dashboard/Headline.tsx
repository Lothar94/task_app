import type { DashboardTotals } from '@fleet/shared';
import { Banknote, CircleAlert, CircleCheck, Clock, Cpu, ShieldCheck } from 'lucide-react';
import { Children, type ReactNode } from 'react';
import { StatTile } from '../../components/StatTile';
import { formatCost, formatDuration, formatInteger, formatPercent, formatTokens } from '../../lib/format';
import {
  averageTaskMs,
  cacheShare,
  errorRate,
  formatPointsDelta,
  formatRelativeDelta,
  pointsDelta,
  relativeDelta,
  successRateOf,
} from './dashboardModel';

/** Mono key/value row for the tile footer; rendered only when the value exists. */
function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p className="flex justify-between gap-2 whitespace-nowrap">
      <span>{label}</span>
      <span className="text-fg-muted">{value}</span>
    </p>
  );
}

/** Tile footer rows; null when none of them exists, so the tile shows no empty footer. */
const footer = (...rows: ReactNode[]) => {
  const present = Children.toArray(rows.filter(Boolean));
  return present.length > 0 ? present : null;
};

/** Change against the previous period; null when there is nothing to compare with. */
const delta = (text: string | null | undefined) =>
  text && <p className="whitespace-nowrap">{text} vs periodo ant.</p>;

const relativeText = (current: number, previous: number | undefined) => {
  const ratio = relativeDelta(current, previous);
  return ratio === null ? null : formatRelativeDelta(ratio);
};

const pointsText = (current: number | null, previous: number | null | undefined) => {
  const points = pointsDelta(current, previous);
  return points === null ? null : formatPointsDelta(points);
};

function SuccessBar({ rate }: { rate: number | null }) {
  return (
    <>
      <span
        role="img"
        aria-label={`Tasa de éxito ${formatPercent(rate)}`}
        className="mb-1.5 block h-1.5 w-full bg-surface-hover"
      >
        <span className="block h-full bg-[var(--status-good)]" style={{ width: `${(rate ?? 0) * 100}%` }} />
      </span>
      completadas / (completadas + fallidas)
    </>
  );
}

export function Headline({
  totals,
  previous,
}: {
  totals: DashboardTotals;
  previous: DashboardTotals | null;
}) {
  const failRate = errorRate(totals);
  const cache = cacheShare(totals);
  const perTask = averageTaskMs(totals);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile
        label="Resueltas"
        value={totals.completed}
        tone="good"
        icon={<CircleCheck />}
        detail={`${totals.active} en curso ahora`}
        footer={footer(delta(previous && relativeText(totals.completed, previous.completed)))}
      />
      <StatTile
        label="Fallidas"
        value={totals.failed}
        tone="critical"
        icon={<CircleAlert />}
        detail={`${totals.cancelled} canceladas`}
        footer={footer(
          failRate !== null && <Metric label="Tasa de error" value={formatPercent(failRate)} />,
          delta(previous && relativeText(totals.failed, previous.failed)),
        )}
      />
      <StatTile
        label="Tasa de éxito"
        icon={<ShieldCheck />}
        value={formatPercent(totals.successRate)}
        detail={<SuccessBar rate={totals.successRate} />}
        footer={footer(delta(previous && pointsText(totals.successRate, successRateOf(previous))))}
      />
      <StatTile
        label="Tokens"
        icon={<Cpu />}
        value={formatTokens(totals.totalTokens)}
        detail={`${formatTokens(totals.outputTokens)} de salida`}
        footer={footer(
          cache !== null && <Metric label="Lectura de caché" value={formatPercent(cache)} />,
          delta(previous && relativeText(totals.totalTokens, previous.totalTokens)),
        )}
      />
      <StatTile
        label="Coste estimado"
        icon={<Banknote />}
        value={formatCost(totals.costUsd)}
        detail="según tarifas de la API"
        footer={footer(
          <Metric label="Ahorro caché" value={`−${formatCost(totals.cacheSavingsUsd)}`} />,
          delta(previous && relativeText(totals.costUsd, previous.costUsd)),
        )}
      />
      <StatTile
        label="Tiempo de agentes"
        icon={<Clock />}
        value={formatDuration(totals.agentTimeMs)}
        detail={`${formatInteger(totals.runs)} ejecuciones`}
        footer={footer(
          perTask !== null && <Metric label="Promedio/tarea" value={formatDuration(perTask)} />,
          delta(previous && relativeText(totals.agentTimeMs, previous.agentTimeMs)),
        )}
      />
    </div>
  );
}
