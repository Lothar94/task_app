import {
  PLAN_USAGE_THRESHOLDS,
  type PlanUsageDto,
  type PlanUsageUnavailableReason,
} from '@fleet/shared';
import { formatDistanceLabel } from '../dashboard/timeAgo';

export type UsageLevel = 'ok' | 'warning' | 'critical';

/** What the UI shows for a snapshot: the limits, or why there are none. */
export type PlanUsageView =
  | { kind: 'available'; usage: PlanUsageDto }
  | { kind: 'unavailable'; reason: PlanUsageUnavailableReason };

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const UNAVAILABLE_COPY: Record<PlanUsageUnavailableReason, string> = {
  no_credentials: 'Sin sesión de Claude en esta máquina',
  expired_credentials: 'Credenciales de Claude caducadas: abre Claude Code para renovarlas',
  upstream_error: 'No se pudo consultar el uso de Claude',
};

const resetDate = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function usageLevel(utilization: number): UsageLevel {
  if (utilization >= PLAN_USAGE_THRESHOLDS.critical) return 'critical';
  if (utilization >= PLAN_USAGE_THRESHOLDS.warning) return 'warning';
  return 'ok';
}

/** 85.6 → 86 (the integer shown and announced). */
export const roundUsage = (utilization: number) => Math.round(utilization);

/** 85.6 → "86 %". */
export const formatUsagePercent = (utilization: number) => `${roundUsage(utilization)} %`;

export const unavailableReasonLabel = (reason: PlanUsageUnavailableReason) => UNAVAILABLE_COPY[reason];

/** "max" → "Plan Max". */
export const subscriptionLabel = (subscriptionType: string) =>
  `Plan ${subscriptionType.charAt(0).toUpperCase()}${subscriptionType.slice(1)}`;

/** 135 min → "2 h 15 min", 120 → "2 h", 45 → "45 min". */
function formatRemaining(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "lun 26, 18:00". */
function formatResetInstant(date: Date): string {
  const parts = Object.fromEntries(resetDate.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.weekday?.replace('.', '')} ${parts.day}, ${parts.hour}:${parts.minute}`;
}

/** "se reinicia en 2 h 15 min" within a day, "se reinicia el lun 26, 18:00" further away; null when unknown. */
export function formatResetLabel(resetsAt: string | null, now = Date.now()): string | null {
  if (resetsAt === null) return null;
  const remainingMs = Date.parse(resetsAt) - now;
  if (Number.isNaN(remainingMs)) return null;
  if (remainingMs <= 0) return 'se reinicia ahora';
  if (remainingMs >= DAY_MS) return `se reinicia el ${formatResetInstant(new Date(resetsAt))}`;
  return `se reinicia en ${formatRemaining(Math.ceil(remainingMs / MINUTE_MS))}`;
}

/** "actualizado hace 3 minutos"; null when the snapshot was never read. */
export function formatUpdatedLabel(fetchedAt: string | null, now = Date.now()): string | null {
  return fetchedAt === null ? null : `actualizado ${formatDistanceLabel(fetchedAt, now)}`;
}

/** Collapses a snapshot (or a failed request) into what the UI renders. */
export function toPlanUsageView(usage: PlanUsageDto | undefined, failed: boolean): PlanUsageView | null {
  if (usage?.available) return { kind: 'available', usage };
  if (usage) return { kind: 'unavailable', reason: usage.reason ?? 'upstream_error' };
  return failed ? { kind: 'unavailable', reason: 'upstream_error' } : null;
}
