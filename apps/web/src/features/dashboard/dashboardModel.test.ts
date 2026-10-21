import type { DailyActivity, RunErrorRow } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { formatDay } from '../../lib/format';
import {
  activityLabel,
  activityTitle,
  averageTaskMs,
  cacheSavingsRate,
  cacheShare,
  causeSummary,
  countByCause,
  errorRate,
  errorsToCsv,
  filterByCause,
  formatPointsDelta,
  formatRelativeDelta,
  modelBreakdown,
  peakDay,
  periodDays,
  periodLabel,
  pointsDelta,
  relativeDelta,
  successRateOf,
  sumCost,
} from './dashboardModel';

const day = (date: string, totalTokens: number) =>
  ({ date, totalTokens, completed: 0, failed: 0 }) as DailyActivity;

describe('dashboard model', () => {
  it('splits a model bar into proportional segments with the chart series colours', () => {
    const segments = modelBreakdown({
      inputTokens: 10,
      outputTokens: 10,
      cacheCreationTokens: 30,
      cacheReadTokens: 50,
    });
    expect(segments.map((s) => s.percent)).toEqual([10, 10, 30, 50]);
    expect(segments.map((s) => s.color)).toEqual([
      'var(--series-1)',
      'var(--series-3)',
      'var(--series-2)',
      'var(--series-4)',
    ]);
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
    expect(averageTaskMs({ agentTimeMs: 1000, tasksRun: 4 })).toBe(250);
    expect(averageTaskMs({ agentTimeMs: 0, tasksRun: 0 })).toBeNull();
    expect(successRateOf({ completed: 3, failed: 1 })).toBe(0.75);
    expect(successRateOf({ completed: 0, failed: 0 })).toBeNull();
  });

  it('computes the prompt-cache saving rate as savings / (cost + savings)', () => {
    expect(cacheSavingsRate({ costUsd: 1, cacheSavingsUsd: 3 })).toBe(0.75);
    expect(cacheSavingsRate({ costUsd: 2, cacheSavingsUsd: 0 })).toBe(0);
    expect(cacheSavingsRate({ costUsd: 0, cacheSavingsUsd: 0 })).toBeNull();
  });

  it('sums the billed cost of a fleet', () => {
    expect(sumCost([{ costUsd: 1.5 }, { costUsd: 2.25 }])).toBe(3.75);
    expect(sumCost([])).toBe(0);
  });

  it('measures change against the previous period and hides it without a base', () => {
    expect(relativeDelta(114, 100)).toBeCloseTo(0.14);
    expect(relativeDelta(50, 100)).toBe(-0.5);
    expect(relativeDelta(5, 0)).toBeNull();
    expect(relativeDelta(5, null)).toBeNull();
    expect(pointsDelta(0.8, 0.75)).toBeCloseTo(5);
    expect(pointsDelta(null, 0.75)).toBeNull();
    expect(pointsDelta(0.8, null)).toBeNull();
    expect(pointsDelta(0.5, 0)).toBe(50);
  });

  it('formats deltas with an explicit sign', () => {
    expect(formatRelativeDelta(0.14)).toBe('+14 %');
    expect(formatRelativeDelta(-0.5)).toBe('−50 %');
    expect(formatRelativeDelta(0)).toBe('0 %');
    expect(formatPointsDelta(3.2)).toBe('+3 pts');
    expect(formatPointsDelta(-12)).toBe('−12 pts');
  });

  it('maps periods to days, with 24h as one day', () => {
    expect(periodDays('24h')).toBe(1);
    expect(periodDays('7')).toBe(7);
    expect(periodDays('all')).toBeNull();
    expect(periodLabel(1)).toBe('Últimas 24 horas');
    expect(periodLabel(30)).toBe('Últimos 30 días');
    expect(periodLabel(null)).toBe('Todo el periodo');
  });

  it('labels hourly buckets as HH:00 and daily ones as dates', () => {
    expect(activityLabel('2026-10-21T08:00', 'hour')).toBe('08:00');
    expect(activityLabel('2026-10-21', 'day')).toBe(formatDay('2026-10-21'));
    expect(activityTitle('2026-10-21T08:00', 'hour')).toBe(`${formatDay('2026-10-21')}, 08:00`);
  });
});

const failure = (overrides: Partial<RunErrorRow>): RunErrorRow => ({
  runId: 'r1',
  taskId: 't1',
  taskNumber: 7,
  taskTitle: 'Arreglar login',
  projectId: 'p1',
  projectName: 'Task app',
  agentName: 'Ana',
  error: 'boom',
  occurredAt: '2026-10-21T08:00:00.000Z',
  cause: 'other',
  retryable: false,
  ...overrides,
});

describe('error causes', () => {
  const errors = [
    failure({ runId: 'a', cause: 'rate_limit' }),
    failure({ runId: 'b', cause: 'interrupted' }),
    failure({ runId: 'c', cause: 'interrupted' }),
  ];

  it('summarises causes with Spanish labels', () => {
    expect(
      causeSummary([
        { cause: 'rate_limit', count: 3 },
        { cause: 'interrupted', count: 2 },
      ]),
    ).toBe('3× Rate limit, 2× Interrumpida');
    expect(causeSummary([])).toBe('');
  });

  it('groups the listed errors by cause, most frequent first', () => {
    expect(countByCause(errors)).toEqual([
      { cause: 'interrupted', count: 2 },
      { cause: 'rate_limit', count: 1 },
    ]);
  });

  it('filters by cause and keeps everything without one', () => {
    expect(filterByCause(errors, 'interrupted').map((e) => e.runId)).toEqual(['b', 'c']);
    expect(filterByCause(errors, null)).toHaveLength(3);
    expect(filterByCause(errors, 'token_limit')).toEqual([]);
  });
});

describe('errorsToCsv', () => {
  it('writes the header and one row per error', () => {
    expect(errorsToCsv([failure({ cause: 'rate_limit' })]).split('\r\n')).toEqual([
      'fecha,proyecto,tarea,agente,causa,error',
      '2026-10-21T08:00:00.000Z,Task app,#7 Arreglar login,Ana,Rate limit,boom',
    ]);
    expect(errorsToCsv([])).toBe('fecha,proyecto,tarea,agente,causa,error');
  });

  it('quotes commas, quotes and line breaks', () => {
    const csv = errorsToCsv([
      failure({ taskTitle: 'Uno, dos', error: 'dijo "hola"\nadiós', projectName: 'a\r\nb' }),
    ]);
    expect(csv).toContain('"#7 Uno, dos"');
    expect(csv).toContain('"dijo ""hola""\nadiós"');
    expect(csv).toContain('"a\r\nb"');
  });

  it('defuses spreadsheet formulas in untrusted text', () => {
    const csv = errorsToCsv([failure({ error: '=HYPERLINK("x")', agentName: '@bot' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(",'@bot,");
  });
});
