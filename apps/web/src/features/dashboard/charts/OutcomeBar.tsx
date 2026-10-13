import type { DashboardTotals } from '@fleet/shared';
import { formatPercent } from '../../../lib/format';
import { TooltipRow, useChartTooltip } from './useChartTooltip';

const OUTCOMES = [
  { key: 'completed', label: 'Completadas', icon: '✓', color: 'var(--status-good)' },
  { key: 'failed', label: 'Fallidas', icon: '✕', color: 'var(--status-critical)' },
  { key: 'cancelled', label: 'Canceladas', icon: '–', color: 'var(--status-neutral)' },
] as const;

/** Part-to-whole of finished tasks; every status carries an icon and a label, never colour alone. */
export function OutcomeBar({ totals }: { totals: DashboardTotals }) {
  const { show, hide, tooltip } = useChartTooltip();
  const finished = totals.completed + totals.failed + totals.cancelled;

  return (
    <div className="space-y-3">
      {finished === 0 ? (
        <p className="text-sm text-zinc-500">Ninguna tarea ha terminado en este periodo.</p>
      ) : (
        <div data-chart className="relative" onMouseLeave={hide}>
          <div className="flex h-4 gap-[2px]">
            {OUTCOMES.filter((outcome) => totals[outcome.key] > 0).map((outcome, index, visible) => (
              <span
                key={outcome.key}
                className={`h-full min-w-[4px] ${index === 0 ? 'rounded-l-[4px]' : ''} ${index === visible.length - 1 ? 'rounded-r-[4px]' : ''}`}
                style={{ flexGrow: totals[outcome.key], background: outcome.color }}
                onMouseMove={(event) =>
                  show(
                    event,
                    <TooltipRow
                      color={outcome.color}
                      label={outcome.label}
                      value={`${totals[outcome.key]} (${formatPercent(totals[outcome.key] / finished)})`}
                    />,
                  )
                }
              />
            ))}
          </div>
          {tooltip}
        </div>
      )}
      <ul className="grid grid-cols-3 gap-2 text-sm">
        {OUTCOMES.map((outcome) => (
          <li key={outcome.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-zinc-950"
              style={{ background: outcome.color }}
            >
              {outcome.icon}
            </span>
            <span className="text-zinc-400">{outcome.label}</span>
            <span className="ml-auto font-mono text-zinc-100 tabular-nums">{totals[outcome.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
