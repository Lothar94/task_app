import { describe, expect, it } from 'vitest';
import { hourlyBuckets, localHourKey } from '../../src/application/metrics/activityBuckets.js';

describe('hourlyBuckets', () => {
  const now = new Date(2026, 9, 21, 13, 30);
  const buckets = hourlyBuckets(now);

  it('has the 24 local hours ending at the current one', () => {
    expect(buckets.keys).toHaveLength(24);
    expect(buckets.keys[0]).toBe(localHourKey(new Date(2026, 9, 20, 14)));
    expect(buckets.keys.at(-1)).toBe(localHourKey(now));
  });

  it('counts the partial hour at the start of the 24-hour window in the first bucket', () => {
    const insideWindow = new Date(now.getTime() - 23.8 * 3_600_000);
    expect(buckets.keyOf(insideWindow)).toBe(buckets.keys[0]);
  });

  it('maps dates inside the buckets to their own hour', () => {
    expect(buckets.keyOf(new Date(2026, 9, 21, 9, 59))).toBe(localHourKey(new Date(2026, 9, 21, 9)));
  });
});
