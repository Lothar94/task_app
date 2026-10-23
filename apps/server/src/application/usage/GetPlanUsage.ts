import { PLAN_USAGE_REFRESH_MS, type PlanUsageDto, type PlanUsageUnavailableReason } from '@fleet/shared';
import type { Clock } from '../ports/Clock.js';
import { PlanUsageUnavailableError, type PlanUsageSource } from '../ports/PlanUsageSource.js';

interface CachedAttempt {
  /** Instant (ms) the attempt finished; the answer is reused until `refreshMs` later. */
  attemptedAt: number;
  failureReason: PlanUsageUnavailableReason | null;
}

/**
 * Usage limits of the Claude plan. Reads upstream at most once per refresh interval (failures
 * included), shares one request between concurrent callers and falls back to the last good
 * snapshot when a refresh fails. Never throws.
 */
export class GetPlanUsage {
  private lastGood: PlanUsageDto | null = null;
  private lastAttempt: CachedAttempt | null = null;
  private inFlight: Promise<PlanUsageDto> | null = null;

  constructor(
    private readonly source: PlanUsageSource,
    private readonly clock: Clock,
    private readonly refreshMs: number = PLAN_USAGE_REFRESH_MS,
  ) {}

  execute(): Promise<PlanUsageDto> {
    if (this.lastAttempt && this.isFresh(this.lastAttempt)) return Promise.resolve(this.current(this.lastAttempt));
    this.inFlight ??= this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private isFresh(attempt: CachedAttempt): boolean {
    return this.clock.now().getTime() - attempt.attemptedAt < this.refreshMs;
  }

  private async refresh(): Promise<PlanUsageDto> {
    let attempt: CachedAttempt;
    try {
      const reading = await this.source.fetch();
      const now = this.clock.now();
      this.lastGood = { available: true, reason: null, ...reading, fetchedAt: now.toISOString() };
      attempt = { attemptedAt: now.getTime(), failureReason: null };
    } catch (error) {
      attempt = {
        attemptedAt: this.clock.now().getTime(),
        failureReason: error instanceof PlanUsageUnavailableError ? error.reason : 'upstream_error',
      };
    }
    this.lastAttempt = attempt;
    return this.current(attempt);
  }

  private current(attempt: CachedAttempt): PlanUsageDto {
    if (this.lastGood) return this.lastGood;
    return {
      available: false,
      reason: attempt.failureReason ?? 'upstream_error',
      subscriptionType: null,
      session: null,
      weekly: null,
      fetchedAt: null,
    };
  }
}
