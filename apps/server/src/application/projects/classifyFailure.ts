import type { ProjectAlertKind } from '@fleet/shared';

const SESSION_LIMIT = /usage limit|hit your limit|5[- ]hour limit|session limit|rate limit/i;
const TOKEN_LIMIT =
  /max_tokens|token limit|context (window|length)|prompt is too long|error_max_budget|maximum context|budget/i;

/** Tells whether a failure reason is a recoverable limit (retrying later can succeed). */
export function classifyFailure(reason: string | null | undefined): ProjectAlertKind | null {
  if (!reason) return null;
  if (SESSION_LIMIT.test(reason)) return 'session_limit';
  if (TOKEN_LIMIT.test(reason)) return 'token_limit';
  return null;
}
