/**
 * Usage limits of the Claude subscription (claude.ai plan) the fleet runs on: the same windows
 * Claude Code's `/usage` shows. They belong to the machine's Claude account, not to an organization.
 *
 * GET /api/plan-usage → PlanUsageDto. Always 200: when the limits cannot be read `available` is
 * false and `reason` says why (the UI shows a neutral "no disponible" state, never an error).
 * The server caches the upstream answer for PLAN_USAGE_REFRESH_MS; if a refresh fails it keeps
 * serving the last good snapshot (with its original `fetchedAt`) instead of becoming unavailable.
 * The client polls every PLAN_USAGE_REFRESH_MS.
 */
export const PLAN_USAGE_REFRESH_MS = 60_000;

/** Utilization at or above which a window is shown as a warning / as critical. */
export const PLAN_USAGE_THRESHOLDS = { warning: 70, critical: 90 } as const;

export const PLAN_USAGE_UNAVAILABLE_REASONS = [
  /** No Claude credentials on this machine, or they are not a claude.ai subscription login (API key, Bedrock, Vertex...). */
  'no_credentials',
  /** The stored OAuth token has expired; running Claude Code once refreshes it. */
  'expired_credentials',
  /** The usage endpoint failed, timed out or answered something unexpected, and there is no previous snapshot. */
  'upstream_error',
] as const;
export type PlanUsageUnavailableReason = (typeof PLAN_USAGE_UNAVAILABLE_REASONS)[number];

/** One rate-limit window of the plan. */
export interface PlanUsageWindowDto {
  /** Percentage of the window used, 0-100 (clamped). */
  utilization: number;
  /** ISO 8601 instant when the window resets; null when unknown. */
  resetsAt: string | null;
}

export interface PlanUsageDto {
  available: boolean;
  /** Null when `available`. */
  reason: PlanUsageUnavailableReason | null;
  /** 'pro' | 'max' | 'team' | 'enterprise'... as stored by Claude Code; null when unknown. */
  subscriptionType: string | null;
  /** 5-hour session window. Null when unavailable or not reported for this plan. */
  session: PlanUsageWindowDto | null;
  /** 7-day weekly window (all models). Null when unavailable or not reported for this plan. */
  weekly: PlanUsageWindowDto | null;
  /** When the snapshot was read from upstream (ISO 8601); null when never read successfully. */
  fetchedAt: string | null;
}
