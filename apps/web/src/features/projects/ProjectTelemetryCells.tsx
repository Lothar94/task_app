import type { ProjectOperationalStatus, ProjectTelemetryDto } from '@fleet/shared';
import { StatusChip, type ChipTone } from '../../components/ui';
import { formatCost, formatDuration, formatInteger, formatPercent, formatTokens } from '../../lib/format';
import { formatDistanceLabel } from '../dashboard/timeAgo';
import { ALERT_CHIP_LABELS, alertText } from './projectAlertLabels';

export const STATUS_CHIP: Record<
  ProjectOperationalStatus,
  { tone: ChipTone; label: string; dot: string; pulse?: boolean }
> = {
  attention: { tone: 'warning', label: 'Atención', dot: 'bg-warning' },
  running: { tone: 'info', label: 'En curso', dot: 'bg-info motion-safe:animate-pulse', pulse: true },
  resting: { tone: 'neutral', label: 'En reposo', dot: 'bg-fg-subtle' },
  idle: { tone: 'neutral', label: 'Inactivo', dot: 'bg-fg-subtle' },
};

export const plural = (count: number, one: string, many: string) =>
  `${formatInteger(count)} ${count === 1 ? one : many}`;

function Skeleton({ className }: { className: string }) {
  return (
    <span className={`block animate-pulse bg-surface-hover motion-reduce:animate-none ${className}`}>
      <span className="sr-only">Cargando…</span>
    </span>
  );
}

export function CellSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-1.5 w-28" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

const percentOf = (part: number, total: number) => (total === 0 ? 0 : (part / total) * 100);

function AlertNotes({ alerts }: { alerts: ProjectTelemetryDto['alerts'] }) {
  if (alerts.length === 0) return null;
  return (
    <ul aria-label="Alertas" className="mt-2 space-y-1">
      {alerts.map((alert) => (
        <li key={alert.kind} className="flex flex-wrap items-center gap-1.5 text-warning">
          <StatusChip tone="warning">{ALERT_CHIP_LABELS[alert.kind]}</StatusChip>
          <span>{alertText(alert)}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatusCell({ telemetry }: { telemetry: ProjectTelemetryDto }) {
  const { counts, successRate, alerts } = telemetry;
  if (counts.total === 0) return <p className="font-mono text-xs text-fg-subtle">Sin tareas</p>;
  return (
    <div className="space-y-1 font-mono text-xs">
      <p className="flex max-w-[11rem] items-center justify-between gap-2 text-fg-subtle">
        <span>{plural(counts.total, 'tarea', 'tareas')}</span>
        {successRate !== null && <span className="text-success">{formatPercent(successRate)} éxito</span>}
      </p>
      <div
        role="img"
        aria-label={`${formatPercent(counts.completed / counts.total)} completadas`}
        className="flex h-1.5 w-full max-w-[11rem] overflow-hidden bg-surface-hover"
      >
        <span
          className="h-full bg-success"
          style={{ width: `${percentOf(counts.completed, counts.total)}%` }}
        />
        <span className="h-full bg-warning" style={{ width: `${percentOf(counts.failed, counts.total)}%` }} />
      </div>
      <p className="flex flex-wrap gap-x-2 text-fg-subtle">
        <span className="text-success">{formatInteger(counts.completed)} comp.</span>
        {counts.active > 0 && <span className="text-info">{formatInteger(counts.active)} en curso</span>}
        {counts.failed > 0 && (
          <span className="text-warning">{plural(counts.failed, 'fallida', 'fallidas')}</span>
        )}
      </p>
      <AlertNotes alerts={alerts} />
    </div>
  );
}

export function LoadCell({ telemetry, now }: { telemetry: ProjectTelemetryDto; now: number }) {
  return (
    <div className="space-y-0.5 font-mono text-xs text-fg-subtle">
      <p className="font-medium text-fg">{formatTokens(telemetry.totalTokens)} tokens</p>
      {telemetry.costUsd > 0 && <p>~{formatCost(telemetry.costUsd)}</p>}
      {telemetry.agentTimeMs > 0 && <p>{formatDuration(telemetry.agentTimeMs)} acumulados</p>}
      {telemetry.lastActivityAt && <p>{formatDistanceLabel(telemetry.lastActivityAt, now)}</p>}
    </div>
  );
}
