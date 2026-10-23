import type { PlanUsageDto } from '@fleet/shared';

export const NOW = Date.parse('2026-10-23T12:00:00.000Z');

export const planUsage = (patch: Partial<PlanUsageDto> = {}): PlanUsageDto => ({
  available: true,
  reason: null,
  subscriptionType: 'max',
  session: { utilization: 85.6, resetsAt: '2026-10-23T14:15:00.000Z' },
  weekly: { utilization: 42, resetsAt: '2026-10-27T18:00:00.000Z' },
  fetchedAt: '2026-10-23T11:57:00.000Z',
  ...patch,
});

export const unavailable = (reason: NonNullable<PlanUsageDto['reason']>): PlanUsageDto =>
  planUsage({ available: false, reason, subscriptionType: null, session: null, weekly: null, fetchedAt: null });
