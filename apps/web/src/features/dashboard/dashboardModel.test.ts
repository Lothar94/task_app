import type { DailyActivity } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { averageRunMs, cacheShare, errorRate, modelBreakdown, peakDay } from './dashboardModel';

const day = (date: string, totalTokens: number) =>
  ({ date, totalTokens, completed: 0, failed: 0 }) as DailyActivity;

describe('dashboard model', () => {
  it('splits a model bar into proportional segments with the reference colours', () => {
    const segments = modelBreakdown({
      inputTokens: 10,
      outputTokens: 10,
      cacheCreationTokens: 30,
      cacheReadTokens: 50,
    });
    expect(segments.map((s) => s.percent)).toEqual([10, 10, 30, 50]);
    expect(segments.map((s) => s.color)).toEqual(['var(--usage-input)', 'var(--usage-output)', 'var(--usage-cache-write)', 'var(--usage-cache-read)']);
  });

  it('omits token kinds without usage and always adds up to 100%', () => {
    const segments = modelBreakdown({
      inputTokens: 1,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 3,
    });
    expect(segments.map((s) => s.key)).toEqual(['inputTokens', 'cacheReadTokens']);
    expect(segments.reduce((sum, s) => sum + s.percent, 0)).toBeCloseTo(100);
  });

  it('finds the peak day and ignores empty periods', () => {
    expect(peakDay([day('2026-10-13', 5), day('2026-10-14', 9), day('2026-10-15', 9)])?.date).toBe(
      '2026-10-14',
    );
    expect(peakDay([day('2026-10-13', 0)])).toBeUndefined();
    expect(peakDay([])).toBeUndefined();
  });

  it('derives tile ratios and guards against empty data', () => {
    expect(errorRate({ completed: 98, failed: 2 })).toBe(0.02);
    expect(errorRate({ completed: 0, failed: 0 })).toBeNull();
    expect(cacheShare({ cacheReadTokens: 92, totalTokens: 100 })).toBe(0.92);
    expect(cacheShare({ cacheReadTokens: 0, totalTokens: 0 })).toBeNull();
    expect(averageRunMs({ agentTimeMs: 1000, runs: 4 })).toBe(250);
    expect(averageRunMs({ agentTimeMs: 0, runs: 0 })).toBeNull();
  });
});
