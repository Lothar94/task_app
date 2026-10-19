import type { ModelUsageRow } from '@fleet/shared';
import { EmptyState } from '../../../components/ui';
import { formatCost, formatInteger, formatPercent, formatTokens } from '../../../lib/format';
import { MODEL_SEGMENTS, modelBreakdown } from '../dashboardModel';
import { Legend, TooltipRow, useChartTooltip } from './useChartTooltip';

function ModelTooltip({ row }: { row: ModelUsageRow }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-fg">{row.model}</p>
      {MODEL_SEGMENTS.map((segment) => (
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

const breakdownLabel = (row: ModelUsageRow) =>
  modelBreakdown(row)
    .map((segment) => `${segment.label} ${formatPercent(segment.percent / 100)}`)
    .join(', ');

export const ModelLegend = () => (
  <Legend items={MODEL_SEGMENTS.map(({ label, color }) => ({ label, color }))} />
);

/** Tokens per model, stacked by kind of token; the total is labelled at the end of each bar. */
export function ModelTokensChart({ rows }: { rows: ModelUsageRow[] }) {
  const { show, hide, tooltip } = useChartTooltip();
  const withTokens = rows.filter((row) => row.totalTokens > 0);
  if (withTokens.length === 0)
    return <EmptyState>Aún no hay consumo de tokens registrado en este periodo.</EmptyState>;

  return (
    <div className="space-y-4">
      <div data-chart className="relative space-y-4" onMouseLeave={hide}>
        {withTokens.map((row) => (
          <div key={row.model}>
            <div className="mb-1 flex items-baseline justify-between gap-3 font-mono text-xs">
              <span className="truncate font-medium text-fg" title={row.model}>
                {row.model}
              </span>
              <span className="whitespace-nowrap text-fg-muted tabular-nums">
                {formatTokens(row.totalTokens)} <span className="text-fg-subtle">tokens</span>
              </span>
            </div>
            <div
              className="flex h-2.5 w-full gap-px"
              role="img"
              aria-label={`${row.model}: ${breakdownLabel(row)}`}
              onMouseMove={(event) => show(event, <ModelTooltip row={row} />)}
            >
              {modelBreakdown(row).map((segment) => (
                <span
                  key={segment.key}
                  className="h-full min-w-[2px]"
                  style={{ flexGrow: segment.tokens, background: segment.color }}
                />
              ))}
            </div>
          </div>
        ))}
        {tooltip}
      </div>
    </div>
  );
}
