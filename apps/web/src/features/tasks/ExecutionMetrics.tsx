import type { TaskExecutionDto } from '@fleet/shared';
import { StatTile } from '../../components/StatTile';
import { ErrorMessage, Loading } from '../../components/ui';
import { formatCost, formatDuration, formatTokens } from '../../lib/format';
import { hasSubtreeTokens, type TimeSegmentKey, timeSegments } from './executionModel';
import { InspectorSection } from './InspectorSection';
import { useTaskExecution } from './taskQueries';

const SEGMENT_COLORS: Record<TimeSegmentKey, string> = {
  llm: 'bg-accent',
  tool: 'bg-info',
  io: 'bg-line-strong',
};

function TimeDistribution({ time }: { time: NonNullable<TaskExecutionDto['time']> }) {
  const segments = timeSegments(time);
  const summary = segments.map((s) => `${s.label} ${s.percent}% (${formatDuration(s.ms)})`).join(', ');
  return (
    <div className="space-y-2">
      <h4 className="label-mono text-fg-subtle">Distribución de tiempo</h4>
      <div
        role="img"
        aria-label={`Distribución de tiempo: ${summary}`}
        className="flex h-2 overflow-hidden rounded-sm bg-canvas"
      >
        {segments.map((s) => (
          <span key={s.key} className={SEGMENT_COLORS[s.key]} style={{ width: `${s.percent}%` }} />
        ))}
      </div>
      <ul className="space-y-1 font-mono text-xs text-fg-muted">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${SEGMENT_COLORS[s.key]}`} />
            <span className="mr-auto">{s.label}</span>
            <span>{s.percent}%</span>
            <span className="text-fg-subtle">{formatDuration(s.ms)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModelList({ models }: { models: TaskExecutionDto['models'] }) {
  return (
    <div className="space-y-1">
      <h4 className="label-mono text-fg-subtle">Por modelo</h4>
      <ul className="space-y-1 font-mono text-xs text-fg-muted">
        {models.map((m) => (
          <li key={m.model} className="flex justify-between gap-2">
            <span className="min-w-0 [overflow-wrap:anywhere]">{m.model}</span>
            <span className="shrink-0 text-fg-subtle">{formatCost(m.costUsd)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Body of the "Métricas de ejecución" section: tiles, time split and per-model cost. */
export function ExecutionMetricsBody({ execution }: { execution: TaskExecutionDto }) {
  if (execution.own.runs === 0) return <p className="text-sm text-fg-subtle">Sin ejecuciones todavía.</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Tokens totales"
          value={formatTokens(execution.own.totalTokens)}
          detail={
            hasSubtreeTokens(execution)
              ? `${formatTokens(execution.subtree.totalTokens)} con árbol`
              : undefined
          }
        />
        <StatTile
          label="Coste estimado"
          value={formatCost(execution.own.costUsd)}
          detail={execution.primaryModel ?? undefined}
        />
      </div>
      {execution.time ? (
        <TimeDistribution time={execution.time} />
      ) : (
        <p className="text-sm text-fg-subtle">Sin datos de tiempo para estas ejecuciones.</p>
      )}
      {execution.models.length > 1 && <ModelList models={execution.models} />}
    </div>
  );
}

export function ExecutionMetricsSection({ taskId }: { taskId: string }) {
  const { data, error } = useTaskExecution(taskId);
  return (
    <InspectorSection
      title="Métricas de ejecución"
      meta={data && data.own.runs > 0 ? formatDuration(data.own.durationMs) : undefined}
    >
      {error ? (
        <ErrorMessage error={error} />
      ) : data ? (
        <ExecutionMetricsBody execution={data} />
      ) : (
        <Loading />
      )}
    </InspectorSection>
  );
}
