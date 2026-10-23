import { PLAN_USAGE_REFRESH_MS } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { PlanUsageUnavailableError } from '../../src/application/ports/PlanUsageSource.js';
import { GetPlanUsage } from '../../src/application/usage/GetPlanUsage.js';
import { FakePlanUsageSource, SAMPLE_READING } from '../support/FakePlanUsageSource.js';

class MutableClock {
  constructor(private time = Date.parse('2026-10-23T10:00:00.000Z')) {}
  now(): Date {
    return new Date(this.time);
  }
  advance(ms: number): void {
    this.time += ms;
  }
}

const expired = new PlanUsageUnavailableError('expired_credentials', 'expired');
const upstreamDown = new PlanUsageUnavailableError('upstream_error', 'down');

describe('GetPlanUsage', () => {
  const setup = (...outcomes: ConstructorParameters<typeof FakePlanUsageSource>) => {
    const source = new FakePlanUsageSource(...outcomes);
    const clock = new MutableClock();
    return { source, clock, useCase: new GetPlanUsage(source, clock) };
  };

  it('reports the reading as available with the fetch instant', async () => {
    const { useCase } = setup();

    expect(await useCase.execute()).toEqual({
      available: true,
      reason: null,
      ...SAMPLE_READING,
      fetchedAt: '2026-10-23T10:00:00.000Z',
    });
  });

  it('serves the cache within the refresh interval with a single upstream call', async () => {
    const { source, clock, useCase } = setup();

    const first = await useCase.execute();
    clock.advance(PLAN_USAGE_REFRESH_MS - 1);

    expect(await useCase.execute()).toEqual(first);
    expect(source.calls).toBe(1);
  });

  it('refreshes once the interval has passed', async () => {
    const updated = { ...SAMPLE_READING, session: { utilization: 90, resetsAt: null } };
    const { source, clock, useCase } = setup(SAMPLE_READING, updated);

    await useCase.execute();
    clock.advance(PLAN_USAGE_REFRESH_MS);
    const second = await useCase.execute();

    expect(source.calls).toBe(2);
    expect(second.session?.utilization).toBe(90);
    expect(second.fetchedAt).toBe('2026-10-23T10:01:00.000Z');
  });

  it('shares one upstream request between concurrent callers', async () => {
    const { source, useCase } = setup();

    const results = await Promise.all([useCase.execute(), useCase.execute(), useCase.execute()]);

    expect(source.calls).toBe(1);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it('keeps serving the last good snapshot, with its original fetchedAt, when a refresh fails', async () => {
    const { source, clock, useCase } = setup(SAMPLE_READING, expired);
    const first = await useCase.execute();

    clock.advance(PLAN_USAGE_REFRESH_MS);
    const second = await useCase.execute();

    expect(source.calls).toBe(2);
    expect(second).toEqual(first);
    expect(second.fetchedAt).toBe('2026-10-23T10:00:00.000Z');
  });

  it('is unavailable with the failure reason when the first call fails', async () => {
    const { useCase } = setup(expired);

    expect(await useCase.execute()).toEqual({
      available: false,
      reason: 'expired_credentials',
      subscriptionType: null,
      session: null,
      weekly: null,
      fetchedAt: null,
    });
  });

  it('caches a failure for the refresh interval and retries afterwards', async () => {
    const { source, clock, useCase } = setup(upstreamDown, SAMPLE_READING);

    expect((await useCase.execute()).reason).toBe('upstream_error');
    clock.advance(PLAN_USAGE_REFRESH_MS - 1);
    expect((await useCase.execute()).available).toBe(false);
    expect(source.calls).toBe(1);

    clock.advance(1);
    expect((await useCase.execute()).available).toBe(true);
    expect(source.calls).toBe(2);
  });

  it('never throws: an unexpected source error becomes upstream_error', async () => {
    const { useCase } = setup(new Error('boom'));

    expect(await useCase.execute()).toMatchObject({ available: false, reason: 'upstream_error' });
  });
});
