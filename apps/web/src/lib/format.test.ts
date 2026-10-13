import { describe, expect, it } from 'vitest';
import { formatCost, formatDay, formatDuration, formatPercent, formatTokens } from './format';

describe('formatters', () => {
  it('formats durations for humans', () => {
    expect(formatDuration(42_000)).toBe('42 s');
    expect(formatDuration(200_000)).toBe('3 min 20 s');
    expect(formatDuration(180_000)).toBe('3 min');
    expect(formatDuration(3_900_000)).toBe('1 h 05 min');
  });

  it('compacts token counts', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(3_200_000)).toMatch(/^3,2\sM$/);
  });

  it('shows tiny costs as less than a cent', () => {
    expect(formatCost(0.003)).toMatch(/^< 0,01\sUS\$$/);
    expect(formatCost(0)).toMatch(/^0,00\sUS\$$/);
  });

  it('formats ratios and days', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(0.666)).toMatch(/^67\s?%$/);
    expect(formatDay('2026-10-12')).toMatch(/12 oct/);
  });
});
