import type { ModelUsageRow } from '@fleet/shared';
import { EmptyState } from '../../../components/ui';
import { formatCost, formatInteger, formatTokens } from '../../../lib/format';
import { Legend, TooltipRow, useChartTooltip } from './useChartTooltip';

const SEGMENTS = [
  { key: 'inputTokens', label: 'Entrada', color: 'var(--series-1)' },
  { key: 'outputTokens', label: 'Salida', color: 'var(--series-2)' },
  { key: 'cacheCreationTokens', label: 'Escritura en caché', color: 'var(--series-3)' },
  { key: 'cacheReadTokens', label: 'Lectura de caché', color: 'var(--series-4)' },
] as const;

function ModelTooltip({ row }: { row: ModelUsageRow }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-zinc-100">{row.model}</p>
      {SEGMENTS.map((segment) => (
        <TooltipRow
          key={segment.key}
          color={segment.color}
          label={segment.label}
          value={formatInteger(row[segment.key])}
        />
      ))}
      <TooltipRow label="Total" value={formatInteger(row.totalTokens)} />
      <TooltipRow label="Coste estimado" value={formatCost(row.costUsd)} />
      <TooltipRow label="Ejecuciones" value={String(row.runs)} />
    </div>
  );
}

/** Tokens per model, stacked by kind of token; the total is labelled at the end of each bar. */
export function ModelTokensChart({ rows }: { rows: ModelUsageRow[] }) {
  const { show, hide, tooltip } = useChartTooltip();
  const withTokens = rows.filter((row) => row.totalTokens > 0);
  if (withTokens.length === 0)
    return <EmptyState>Aún no hay consumo de tokens registrado en este periodo.</EmptyState>;
  const max = Math.max(...withTokens.map((row) => row.totalTokens));

  return (
    <div className="space-y-4">
      <Legend items={SEGMENTS.map(({ label, color }) => ({ label, color }))} />
      <div data-chart className="relative space-y-3" onMouseLeave={hide}>
        {withTokens.map((row) => (
          <div
            key={row.model}
            className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] items-center gap-3"
          >
            <span className="truncate font-mono text-xs text-zinc-300" title={row.model}>
              {row.model}
            </span>
            <div
              className="flex h-5 gap-[2px] border-l border-[var(--chart-axis)]"
              style={{ width: `${(row.totalTokens / max) * 100}%` }}
              onMouseMove={(event) => show(event, <ModelTooltip row={row} />)}
            >
              {SEGMENTS.filter((segment) => row[segment.key] > 0).map((segment, index, visible) => (
                <span
                  key={segment.key}
                  className={`h-full min-w-[2px] ${index === visible.length - 1 ? 'rounded-r-[4px]' : ''}`}
                  style={{ flexGrow: row[segment.key], background: segment.color }}
                />
              ))}
            </div>
            <span className="text-right font-mono text-xs text-zinc-300 tabular-nums">
              {formatTokens(row.totalTokens)}
            </span>
          </div>
        ))}
        {tooltip}
      </div>
    </div>
  );
}
