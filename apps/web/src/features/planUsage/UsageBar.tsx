import type { PlanUsageWindowDto } from '@fleet/shared';
import { formatResetLabel, formatUsagePercent, roundUsage, usageLevel } from './planUsageModel';
import { LEVEL_FILL } from './usageLevelStyle';

interface UsageBarProps {
  label: string;
  window: PlanUsageWindowDto;
  now: number;
}

/** One rate-limit window: label, % used, a bar filled by level and when it resets. */
export function UsageBar({ label, window, now }: UsageBarProps) {
  const percent = roundUsage(window.utilization);
  const level = usageLevel(window.utilization);
  const resetLabel = formatResetLabel(window.resetsAt, now);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-fg-muted">{label}</span>
        <span className="font-mono font-semibold text-fg">{formatUsagePercent(window.utilization)}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={formatUsagePercent(window.utilization)}
        data-level={level}
        className="h-2 overflow-hidden rounded-full bg-line-strong"
      >
        <div className={`h-full rounded-full ${LEVEL_FILL[level]}`} style={{ width: `${percent}%` }} />
      </div>
      {resetLabel && <p className="text-xs text-fg-subtle">{resetLabel}</p>}
    </div>
  );
}
