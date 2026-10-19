import type { DailyActivity, DashboardTotals, ModelUsageRow, TokenTotals } from '@fleet/shared';

type SegmentKey = 'inputTokens' | 'outputTokens' | 'cacheCreationTokens' | 'cacheReadTokens';

/** Token kinds of the model chart, in stacking order; colours follow the Obsidian reference. */
export const MODEL_SEGMENTS: { key: SegmentKey; label: string; color: string }[] = [
  { key: 'inputTokens', label: 'Entrada', color: 'var(--usage-input)' },
  { key: 'outputTokens', label: 'Salida', color: 'var(--usage-output)' },
  { key: 'cacheCreationTokens', label: 'Escritura en caché', color: 'var(--usage-cache-write)' },
  { key: 'cacheReadTokens', label: 'Lectura de caché', color: 'var(--usage-cache-read)' },
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

/** Mean agent working time per run; null without runs. */
export const averageRunMs = ({ agentTimeMs, runs }: Pick<DashboardTotals, 'agentTimeMs' | 'runs'>) =>
  runs === 0 ? null : agentTimeMs / runs;
