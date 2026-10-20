import type { ModelTokenUsage, RunOutcome, TaskMetricsDto } from './metrics.js';

/**
 * How the wall-clock time of a task's runs splits up, summed over runs.
 * - `llmMs`: time waiting for the model API (the SDK's `duration_api_ms`).
 * - `toolMs`: time between each tool call and its result (overlapping calls count once),
 *   including waiting on delegated subtasks.
 * - `ioMs`: the rest (process start-up, streaming, persistence): `totalMs - llmMs - toolMs`, never negative.
 * Runs recorded before timing existed are left out of every field here.
 */
export interface TimeBreakdown {
  totalMs: number;
  llmMs: number;
  toolMs: number;
  ioMs: number;
}

export interface TaskRunSummary {
  /** 1-based, in start order. */
  number: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  outcome: RunOutcome;
  totalTokens: number;
  costUsd: number;
}

/**
 * GET /api/tasks/:id/execution — telemetry of a task (404 when the task does not exist).
 * Token totals and cost are estimates from the model's price table (Claude Code's own figures).
 */
export interface TaskExecutionDto {
  taskId: string;
  /** The task's own runs. */
  own: TaskMetricsDto;
  /** The task plus every descendant subtask, at any depth. */
  subtree: TaskMetricsDto;
  /** Own runs only; null when no run has timing data (no runs yet, or only legacy runs). */
  time: TimeBreakdown | null;
  /** Own usage per model, sorted by cost descending. */
  models: ModelTokenUsage[];
  /** Model with the highest own cost (ties: most tokens); null when there is no usage. */
  primaryModel: string | null;
  /** Own runs, oldest first. */
  runs: TaskRunSummary[];
}

export interface GitFileChange {
  /** Path relative to the repository root (the new path for renames). */
  path: string;
  /** null for binary files. */
  additions: number | null;
  deletions: number | null;
}

export interface GitCommitRef {
  /** Full SHA. */
  sha: string;
  /** Branch checked out when it was captured; null on a detached HEAD. */
  branch: string | null;
}

/** GET /api/tasks/:id/git — read-only git context of the task in its project's workspace. */
export type TaskGitContextDto =
  /** The project's workspace does not exist or is not inside a git repository. */
  | { status: 'not_a_repository'; taskId: string }
  /** The workspace is a repository but the task has never run since snapshots exist. */
  | { status: 'no_snapshot'; taskId: string; currentBranch: string | null }
  | {
      status: 'ok';
      taskId: string;
      /** Branch checked out in the workspace right now; null on a detached HEAD. */
      currentBranch: string | null;
      /** HEAD when the task's first run started. */
      base: GitCommitRef;
      /** HEAD when the last run finished; while a run is in progress, the live HEAD. */
      head: GitCommitRef;
      /**
       * Changes from `base` to `head`. While the task is running they also include uncommitted
       * changes of the working tree. Sorted by path.
       */
      files: GitFileChange[];
      /** True while the task is running and `head`/`files` are live. */
      live: boolean;
    };

export const GIT_DIFF_MAX_BYTES = 512 * 1024;

/**
 * GET /api/tasks/:id/git/diff — unified diff (`git diff base head`, or against the working tree
 * while running) with the same scope as `TaskGitContextDto.files`.
 * 409 CONFLICT when the git context status is not `ok`.
 */
export interface TaskGitDiffDto {
  taskId: string;
  baseSha: string;
  /** null when the diff is against the live working tree. */
  headSha: string | null;
  patch: string;
  /** True when the patch was cut at GIT_DIFF_MAX_BYTES. */
  truncated: boolean;
}
