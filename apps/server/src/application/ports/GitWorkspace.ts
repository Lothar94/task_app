import type { GitCommitRef, GitFileChange } from '@fleet/shared';

export interface GitDiff {
  patch: string;
  truncated: boolean;
}

/**
 * Read-only view of the git repository in a project's workspace. Implementations must never
 * modify the workspace (no checkout, fetch, add, stash, commit, index refresh...).
 * `head` null in the comparisons means the working tree.
 */
export interface GitWorkspace {
  /** Current HEAD, or null when the path is not a repository (or it has no commits yet). */
  head(path: string): Promise<GitCommitRef | null>;
  /** Files changed between `base` and `head`, with the new path for renames. Unsorted. */
  changedFiles(path: string, base: string, head: string | null): Promise<GitFileChange[]>;
  /** Unified diff cut at `maxBytes`. */
  diff(path: string, base: string, head: string | null, maxBytes: number): Promise<GitDiff>;
}
