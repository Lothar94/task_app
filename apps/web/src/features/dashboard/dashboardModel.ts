import type {
  ActivityGranularity,
  DailyActivity,
  DashboardTotals,
  ModelUsageRow,
  RunErrorCause,
  RunErrorCauseCount,
  RunErrorRow,
  TokenTotals,
} from '@fleet/shared';
import { formatDay } from '../../lib/format';

type SegmentKey = 'inputTokens' | 'outputTokens' | 'cacheCreationTokens' | 'cacheReadTokens';

/** Token kinds of the model chart, in stacking order; colours come from the chart series tokens. */
export const MODEL_SEGMENTS: { key: SegmentKey; label: string; color: string }[] = [
  { key: 'inputTokens', label: 'Entrada', color: 'var(--series-1)' },
  { key: 'outputTokens', label: 'Salida', color: 'var(--series-3)' },
  { key: 'cacheCreationTokens', label: 'Escritura en caché', color: 'var(--series-2)' },
  { key: 'cacheReadTokens', label: 'Lectura de caché', color: 'var(--series-4)' },
];

export interface ModelSegment {
  key: SegmentKey;
  label: string;
  color: string;
  tokens: number;
  /** Share of the model's total, 0–100. */
  percent: number;
}

/** Proportional breakdown of one model's tokens; kinds without tokens are left out. */
export function modelBreakdown(row: Pick<ModelUsageRow, SegmentKey>): ModelSegment[] {
  const total = MODEL_SEGMENTS.reduce((sum, segment) => sum + row[segment.key], 0);
  return MODEL_SEGMENTS.filter((segment) => row[segment.key] > 0).map((segment) => ({
    ...segment,
    tokens: row[segment.key],
    percent: (row[segment.key] / total) * 100,
  }));
}

/** Day with the most tokens (the earliest on a tie); undefined when no tokens were used. */
export function peakDay(days: DailyActivity[]): DailyActivity | undefined {
  return days.reduce<DailyActivity | undefined>(
    (peak, day) => (day.totalTokens > (peak?.totalTokens ?? 0) ? day : peak),
    undefined,
  );
}

/** Failed / (completed + failed); null when no task finished. */
export const errorRate = ({ completed, failed }: Pick<DashboardTotals, 'completed' | 'failed'>) =>
  completed + failed === 0 ? null : failed / (completed + failed);

/** Share of all tokens that were read from the prompt cache; null without tokens. */
export const cacheShare = ({
  cacheReadTokens,
  totalTokens,
}: Pick<TokenTotals, 'cacheReadTokens' | 'totalTokens'>) =>
  totalTokens === 0 ? null : cacheReadTokens / totalTokens;

/** Mean agent working time per task that ran; null without tasks. */
export const averageTaskMs = ({
  agentTimeMs,
  tasksRun,
}: Pick<DashboardTotals, 'agentTimeMs' | 'tasksRun'>) => (tasksRun === 0 ? null : agentTimeMs / tasksRun);

/** Share of the would-be cost that the prompt cache saved: savings / (cost + savings); null without either. */
export const cacheSavingsRate = ({
  costUsd,
  cacheSavingsUsd,
}: Pick<TokenTotals, 'costUsd'> & { cacheSavingsUsd: number }) =>
  costUsd + cacheSavingsUsd <= 0 ? null : cacheSavingsUsd / (costUsd + cacheSavingsUsd);

/** Total billed by a set of rows. */
export const sumCost = (rows: Pick<TokenTotals, 'costUsd'>[]) =>
  rows.reduce((sum, row) => sum + row.costUsd, 0);

/** completed / (completed + failed); null when nothing finished. */
export const successRateOf = ({ completed, failed }: { completed: number; failed: number }) =>
  completed + failed === 0 ? null : completed / (completed + failed);

/** Relative change against the previous period (0.14 = +14 %); null when there is no base to compare. */
export function relativeDelta(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}

/** Percentage-point change of a rate against the previous period; null unless both rates exist. */
export function pointsDelta(current: number | null, previous: number | null | undefined): number | null {
  if (current === null || previous === null || previous === undefined) return null;
  return (current - previous) * 100;
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value).replace('-', '−'));

/** 0.14 → "+14 %", -0.5 → "−50 %". */
export const formatRelativeDelta = (ratio: number) => `${signed(Math.round(ratio * 100))} %`;

/** 3.2 → "+3 pts". */
export const formatPointsDelta = (points: number) => `${signed(Math.round(points))} pts`;

/** Selectable periods; "24h" is the last day with hourly activity. */
export const PERIODS = ['24h', '7', '30', '90', 'all'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'all', label: 'Todo' },
];

export const periodDays = (period: Period): number | null =>
  period === 'all' ? null : period === '24h' ? 1 : Number(period);

export const periodLabel = (days: number | null) =>
  days === null ? 'Todo el periodo' : days === 1 ? 'Últimas 24 horas' : `Últimos ${days} días`;

/** Axis label of an activity bucket: "08:00" for hourly buckets, "12 oct" for daily ones. */
export const activityLabel = (bucket: string, granularity: ActivityGranularity) =>
  granularity === 'hour' ? bucket.slice(11, 16) : formatDay(bucket);

/** Tooltip title of an activity bucket: "12 oct, 08:00" or "12 oct". */
export const activityTitle = (bucket: string, granularity: ActivityGranularity) =>
  granularity === 'hour'
    ? `${formatDay(bucket.slice(0, 10))}, ${activityLabel(bucket, granularity)}`
    : formatDay(bucket);

export const CAUSE_LABELS: Record<RunErrorCause, string> = {
  rate_limit: 'Rate limit',
  session_limit: 'Límite de sesión',
  token_limit: 'Límite de tokens',
  interrupted: 'Interrumpida',
  other: 'Otra',
};

/** "3× Rate limit, 2× Interrumpida"; empty without causes. */
export const causeSummary = (causes: RunErrorCauseCount[]) =>
  causes.map(({ cause, count }) => `${count}× ${CAUSE_LABELS[cause]}`).join(', ');

/** Errors of one cause; every error when no cause is selected. */
export const filterByCause = (errors: RunErrorRow[], cause: RunErrorCause | null) =>
  cause === null ? errors : errors.filter((error) => error.cause === cause);

/** Listed errors per cause, most frequent first (ties keep the cause order). */
export function countByCause(errors: RunErrorRow[]): RunErrorCauseCount[] {
  const counts = new Map<RunErrorCause, number>();
  for (const { cause } of errors) counts.set(cause, (counts.get(cause) ?? 0) + 1);
  return [...counts].map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count);
}

const CSV_COLUMNS = ['fecha', 'proyecto', 'tarea', 'agente', 'causa', 'error'];

/** Quotes a cell when needed and defuses spreadsheet formulas (error text is untrusted). */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** RFC 4180 CSV (CRLF) of the given errors, header included. */
export function errorsToCsv(errors: RunErrorRow[]): string {
  const rows = errors.map((error) => [
    error.occurredAt,
    error.projectName,
    `#${error.taskNumber} ${error.taskTitle}`,
    error.agentName,
    CAUSE_LABELS[error.cause],
    error.error,
  ]);
  return [CSV_COLUMNS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
