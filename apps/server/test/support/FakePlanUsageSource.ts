import type { PlanUsageReading, PlanUsageSource } from '../../src/application/ports/PlanUsageSource.js';

export const SAMPLE_READING: PlanUsageReading = {
  subscriptionType: 'max',
  session: { utilization: 86, resetsAt: '2026-10-23T12:50:00.080+00:00' },
  weekly: { utilization: 42, resetsAt: '2026-10-27T09:00:00.000+00:00' },
};

/** Answers with the queued outcomes in order (the last one repeats); counts the calls. */
export class FakePlanUsageSource implements PlanUsageSource {
  calls = 0;
  private readonly outcomes: (PlanUsageReading | Error)[];

  constructor(...outcomes: (PlanUsageReading | Error)[]) {
    this.outcomes = outcomes.length > 0 ? outcomes : [SAMPLE_READING];
  }

  async fetch(): Promise<PlanUsageReading> {
    const outcome = this.outcomes[Math.min(this.calls, this.outcomes.length - 1)] as PlanUsageReading | Error;
    this.calls += 1;
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }
}
