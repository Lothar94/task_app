import type { ProjectAlertKind } from '@fleet/shared';
import type { Task } from '../../domain/task/Task.js';

const SESSION_LIMIT = /usage limit|hit your limit|5[- ]hour limit|session limit|rate limit/i;
const TOKEN_LIMIT =
  /max_tokens|token limit|context (window|length)|prompt is too long|maximum context|max[_ ]budget|budget (limit|exceeded)|(exceeded|over) .*budget|over budget/i;

/** Tells whether a failure reason is a recoverable limit (retrying later can succeed). */
export function classifyFailure(reason: string | null | undefined): ProjectAlertKind | null {
  if (!reason) return null;
  if (SESSION_LIMIT.test(reason)) return 'session_limit';
  if (TOKEN_LIMIT.test(reason)) return 'token_limit';
  return null;
}

/** Failed root tasks that stopped on a recoverable limit, oldest first. */
export function recoverableFailures(tasks: Task[]): Task[] {
  return tasks
    .filter(
      (task) =>
        task.status === 'failed' &&
        task.parentTaskId === null &&
        classifyFailure(task.resultSummary) !== null,
    )
    .sort((a, b) => a.toSnapshot().createdAt.getTime() - b.toSnapshot().createdAt.getTime());
}
