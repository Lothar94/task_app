import type { ActivityGranularity } from '@fleet/shared';

const HOUR_MS = 3_600_000;
const HOURS_IN_DAY = 24;

/** Keys of the activity chart in order, and how a date maps to one of them. */
export interface ActivityBuckets {
  granularity: ActivityGranularity;
  keys: string[];
  keyOf: (date: Date) => string;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localHourKey(date: Date): string {
  return `${localDateKey(date)}T${pad(date.getHours())}:00`;
}

/**
 * The 24 local hours ending at the current one. The 24-hour window starts inside the hour
 * before the first bucket, so that partial hour is counted in the first bucket.
 */
export function hourlyBuckets(now: Date): ActivityBuckets {
  const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const firstHour = currentHour.getTime() - (HOURS_IN_DAY - 1) * HOUR_MS;
  const keys = Array.from({ length: HOURS_IN_DAY }, (_, index) =>
    localHourKey(new Date(firstHour + index * HOUR_MS)),
  );
  const firstKey = keys[0] ?? localHourKey(currentHour);
  const keyOf = (date: Date) => (date.getTime() < firstHour ? firstKey : localHourKey(date));
  return { granularity: 'hour', keys: [...new Set(keys)], keyOf };
}

/** Every local day from the day of `start` to the day of `now`, both included. */
export function dailyBuckets(start: Date, now: Date): ActivityBuckets {
  const keys: string[] = [];
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (; day <= now; day.setDate(day.getDate() + 1)) keys.push(localDateKey(day));
  return { granularity: 'day', keys, keyOf: localDateKey };
}
