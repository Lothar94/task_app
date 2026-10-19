import type { DailyActivity } from '@fleet/shared';
import { EmptyState } from '../../../components/ui';
import { formatDay, formatInteger, formatTokens } from '../../../lib/format';
import { TooltipRow, useChartTooltip } from './useChartTooltip';

const PLOT_HEIGHT = 'h-48';

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

function DayTooltip({ day }: { day: DailyActivity }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-fg">{formatDay(day.date)}</p>
      <TooltipRow color="var(--series-1)" label="Tokens" value={formatInteger(day.totalTokens)} />
      <TooltipRow label="Tareas completadas" value={String(day.completed)} />
      <TooltipRow label="Tareas fallidas" value={String(day.failed)} />
    </div>
  );
}

/** Tokens consumed per day (single series); hover a day for its task outcomes. */
export function DailyActivityChart({ days }: { days: DailyActivity[] }) {
  const { show, hide, tooltip } = useChartTooltip();
  if (days.every((day) => day.totalTokens === 0)) {
    return <EmptyState>Sin tokens registrados en este periodo.</EmptyState>;
  }
  const max = niceMax(Math.max(0, ...days.map((day) => day.totalTokens)));
  const ticks = [max, max / 2, 0];
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));

  return (
    <div data-chart className="relative" onMouseLeave={hide}>
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
        <div className={`relative ${PLOT_HEIGHT}`}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 font-mono text-[0.6875rem] text-fg-subtle tabular-nums"
              style={{ top: `${(1 - tick / max) * 100}%` }}
            >
              {formatTokens(tick)}
            </span>
          ))}
        </div>
        <div className={`relative ${PLOT_HEIGHT} border-b border-[var(--chart-axis)]`}>
          {ticks.slice(0, -1).map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-[var(--chart-grid)]"
              style={{ top: `${(1 - tick / max) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {days.map((day) => (
              <div
                key={day.date}
                className="group flex h-full min-w-0 flex-1 items-end hover:bg-surface-hover"
                onMouseMove={(event) => show(event, <DayTooltip day={day} />)}
              >
                <div
                  className="w-full rounded-t-[2px] bg-[var(--series-1)]"
                  style={{
                    height: `${(day.totalTokens / max) * 100}%`,
                    minHeight: day.totalTokens > 0 ? 2 : 0,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-[4rem] flex gap-[2px] pt-1">
        {days.map((day, index) => (
          <span
            key={day.date}
            className="min-w-0 flex-1 text-center font-mono text-[0.6875rem] whitespace-nowrap text-fg-subtle"
          >
            {index % labelEvery === 0 ? formatDay(day.date) : ''}
          </span>
        ))}
      </div>
      {tooltip}
    </div>
  );
}
