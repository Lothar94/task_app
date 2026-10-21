import type { RunErrorCause } from '@fleet/shared';
import { TOKEN_LIMIT } from '../projects/classifyFailure.js';

const SESSION_LIMIT = /session limit|usage limit|hit your limit|5[- ]hour limit/i;
const RATE_LIMIT = /rate.?limit|429|too many requests|overloaded/i;
const INTERRUPTED = /^Interrupted|server stopped/i;

/** Session limits are checked before rate limits: their messages may mention both. */
const CAUSES: ReadonlyArray<[RegExp, RunErrorCause]> = [
  [SESSION_LIMIT, 'session_limit'],
  [RATE_LIMIT, 'rate_limit'],
  [TOKEN_LIMIT, 'token_limit'],
  [INTERRUPTED, 'interrupted'],
];

/** Groups the error of a failed run into a cause the dashboard can count. */
export function classifyRunError(error: string | null): RunErrorCause {
  if (!error) return 'other';
  return CAUSES.find(([pattern]) => pattern.test(error))?.[1] ?? 'other';
}
