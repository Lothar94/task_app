import type { PlanUsageUnavailableReason, PlanUsageWindowDto } from '@fleet/shared';

export interface PlanUsageReading {
  subscriptionType: string | null;
  session: PlanUsageWindowDto | null;
  weekly: PlanUsageWindowDto | null;
}

/** Thrown by a source that cannot read the plan usage; `reason` is what the UI gets to see. */
export class PlanUsageUnavailableError extends Error {
  constructor(
    readonly reason: PlanUsageUnavailableReason,
    message: string,
  ) {
    super(message);
    this.name = 'PlanUsageUnavailableError';
  }
}

export interface PlanUsageSource {
  /** @throws PlanUsageUnavailableError when the usage cannot be read. */
  fetch(): Promise<PlanUsageReading>;
}
