import { PLAN_USAGE_REFRESH_MS } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { PlanUsageUnavailableError } from '../../src/application/ports/PlanUsageSource.js';
import { GetPlanUsage } from '../../src/application/usage/GetPlanUsage.js';
import { FakePlanUsageSource, SAMPLE_READING } from '../support/FakePlanUsageSource.js';

class MutableClock {
  private time = Date.parse('2026-10-23T10:00:00.000Z');
  now(): Date {
    return new Date(this.time);
  }
  advance(ms: number): void {
    this.time += ms;
  }
}

const down = new PlanUsageUnavailableError('upstream_error', 'down');

describe('GetPlanUsage cache (QA)', () => {
  it('keeps the original snapshot across repeated failed refreshes and still calls upstream at most once per interval', async () => {
    const source = new FakePlanUsageSource(SAMPLE_READING, down);
    const clock = new MutableClock();
    const useCase = new GetPlanUsage(source, clock);
    const first = await useCase.execute();

    for (let round = 1; round <= 3; round++) {
      clock.advance(PLAN_USAGE_REFRESH_MS);
      expect(await useCase.execute()).toEqual(first);
      clock.advance(PLAN_USAGE_REFRESH_MS - 1);
      expect(await useCase.execute()).toEqual(first);
      expect(source.calls).toBe(1 + round);
    }
  });

  it('recovers with a new fetchedAt once upstream works again after failures', async () => {
    const updated = { ...SAMPLE_READING, session: { utilization: 5, resetsAt: null } };
    const source = new FakePlanUsageSource(SAMPLE_READING, down, updated);
    const clock = new MutableClock();
    const useCase = new GetPlanUsage(source, clock);
    await useCase.execute();
    clock.advance(PLAN_USAGE_REFRESH_MS);
    await useCase.execute();
    clock.advance(PLAN_USAGE_REFRESH_MS);

    const recovered = await useCase.execute();

    expect(recovered.session?.utilization).toBe(5);
    expect(recovered.fetchedAt).toBe('2026-10-23T10:02:00.000Z');
  });

  it('shares one request between many concurrent callers and later calls hit the cache', async () => {
    const source = new FakePlanUsageSource();
    const useCase = new GetPlanUsage(source, new MutableClock());

    const results = await Promise.all(Array.from({ length: 10 }, () => useCase.execute()));
    await useCase.execute();

    expect(source.calls).toBe(1);
    expect(new Set(results.map((r) => r.fetchedAt)).size).toBe(1);
  });
});
