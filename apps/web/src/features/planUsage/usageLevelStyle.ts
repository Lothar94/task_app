import type { UsageLevel } from './planUsageModel';

/** Tailwind classes per level, written out whole so the compiler sees them. */
export const LEVEL_FILL: Record<UsageLevel, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
};

export const LEVEL_STROKE: Record<UsageLevel, string> = {
  ok: 'stroke-success',
  warning: 'stroke-warning',
  critical: 'stroke-danger',
};
