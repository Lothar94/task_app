import { type KeyboardEvent, useId, useState } from 'react';
import { FOCUS_RING } from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { formatUpdatedLabel, formatUsagePercent, roundUsage, subscriptionLabel, toPlanUsageView, usageLevel } from './planUsageModel';
import type { PlanUsageView } from './planUsageModel';
import { PlanUsageBars } from './PlanUsageBars';
import { LEVEL_STROKE } from './usageLevelStyle';
import { usePlanUsage } from './usePlanUsage';

const NOW_REFRESH_MS = 30_000;
const SIZE = 28;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Session percentage (0-100) of a view, null when there is nothing to draw. */
const sessionUtilization = (view: PlanUsageView | null) =>
  view?.kind === 'available' ? (view.usage.session?.utilization ?? null) : null;

function Donut({ utilization }: { utilization: number | null }) {
  const filled = utilization === null ? 0 : (Math.min(utilization, 100) / 100) * CIRCUMFERENCE;
  return (
    <svg aria-hidden viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-7 -rotate-90">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-line-strong" />
      {utilization !== null && (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          className={LEVEL_STROKE[usageLevel(utilization)]}
        />
      )}
    </svg>
  );
}

function indicatorLabel(view: PlanUsageView, utilization: number | null) {
  if (view.kind === 'unavailable' || utilization === null) return 'Uso de Claude: no disponible';
  return `Uso de Claude: sesión ${formatUsagePercent(utilization)}`;
}

function PlanUsagePopover({ id, view, now }: { id: string; view: PlanUsageView; now: number }) {
  const subscriptionType = view.kind === 'available' ? view.usage.subscriptionType : null;
  const updated = view.kind === 'available' ? formatUpdatedLabel(view.usage.fetchedAt, now) : null;
  return (
    <div className="absolute top-full right-2 z-50 pt-1 sm:right-0">
      <div
        id={id}
        role="tooltip"
        className="w-64 max-w-[calc(100vw-1rem)] space-y-3 rounded-sm border border-line bg-surface-raised p-3 shadow-float"
      >
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Uso de Claude</h2>
          {subscriptionType && <span className="label-mono text-fg-subtle">{subscriptionLabel(subscriptionType)}</span>}
        </header>
        <PlanUsageBars view={view} now={now} />
        {updated && <p className="text-xs text-fg-subtle">{updated}</p>}
      </div>
    </div>
  );
}

/** Masthead donut with the session limit of the Claude plan; hover or focus reveals both limits. */
export function PlanUsageIndicator() {
  const planUsage = usePlanUsage();
  const now = useNow(true, NOW_REFRESH_MS);
  const tooltipId = useId();
  const [isOpen, setOpen] = useState(false);
  const view = toPlanUsageView(planUsage.data, planUsage.isError);

  if (!view) {
    return (
      <span role="status" aria-label="Cargando uso de Claude" className="grid size-8 place-items-center">
        <span aria-hidden className="size-7 animate-pulse rounded-full border-[3px] border-line-strong" />
      </span>
    );
  }

  const utilization = sessionUtilization(view);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    setOpen(false);
  };

  return (
    <div
      className="sm:relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label={indicatorLabel(view, utilization)}
        aria-describedby={isOpen ? tooltipId : undefined}
        className={`relative grid size-8 place-items-center rounded-sm hover:bg-surface-hover ${FOCUS_RING}`}
      >
        <Donut utilization={utilization} />
        <span aria-hidden className="absolute font-mono text-[0.5625rem] leading-none font-semibold text-fg">
          {utilization === null ? '—' : roundUsage(utilization)}
        </span>
      </button>
      {isOpen && <PlanUsagePopover id={tooltipId} view={view} now={now} />}
    </div>
  );
}
