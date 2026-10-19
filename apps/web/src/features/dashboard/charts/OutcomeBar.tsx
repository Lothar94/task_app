import type { DashboardTotals } from '@fleet/shared';
import { CircleCheck, CircleMinus, CircleX } from 'lucide-react';
import { formatPercent } from '../../../lib/format';
import { TooltipRow, useChartTooltip } from './useChartTooltip';

const OUTCOMES = [
  { key: 'completed', label: 'Completadas', icon: CircleCheck, color: 'var(--status-good)' },
  { key: 'failed', label: 'Fallidas', icon: CircleX, color: 'var(--status-critical)' },
  { key: 'cancelled', label: 'Canceladas', icon: CircleMinus, color: 'var(--status-neutral)' },
] as const;

/** Part-to-whole of finished tasks; every status carries an icon and a label, never colour alone. */
export function OutcomeBar({ totals }: { totals: DashboardTotals }) {
  const { show, hide, tooltip } = useChartTooltip();
  const finished = totals.completed + totals.failed + totals.cancelled;

  return (
    <div className="space-y-3">
      {finished === 0 ? (
        <p className="text-sm text-fg-subtle">Ninguna tarea ha terminado en este periodo.</p>
      ) : (
        <div data-chart className="relative" onMouseLeave={hide}>
          <div className="flex h-3 gap-[2px]">
            {OUTCOMES.filter((outcome) => totals[outcome.key] > 0).map((outcome, index, visible) => (
              <span
                key={outcome.key}
                className={`h-full min-w-[4px] ${index === 0 ? 'rounded-l-[2px]' : ''} ${index === visible.length - 1 ? 'rounded-r-[2px]' : ''}`}
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
      <ul className="grid grid-cols-3 gap-2">
        {OUTCOMES.map(({ key, label, icon: Icon, color }) => (
          <li key={key} className="rounded border border-line bg-surface-raised/50 p-2.5">
            <p className="label-mono flex items-center gap-1.5 text-fg-subtle">
              <Icon aria-hidden className="size-3.5" style={{ color }} />
              {label}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-fg tabular-nums">{totals[key]}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
