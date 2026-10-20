import type { GitCommitRef, GitFileChange } from '@fleet/shared';
import type { GitDiff, GitWorkspace } from '../../src/application/ports/GitWorkspace.js';

/** In-memory git: one HEAD per path, scripted changes and diffs; records every comparison asked. */
export class FakeGitWorkspace implements GitWorkspace {
  readonly heads = new Map<string, GitCommitRef>();
  files: GitFileChange[] = [];
  patch = '';
  truncated = false;
  failWith: Error | null = null;
  readonly comparisons: { base: string; head: string | null }[] = [];

  async head(path: string): Promise<GitCommitRef | null> {
    if (this.failWith) throw this.failWith;
    return this.heads.get(path) ?? null;
  }

  async changedFiles(_path: string, base: string, head: string | null): Promise<GitFileChange[]> {
    this.comparisons.push({ base, head });
    return this.files;
  }

  async diff(_path: string, base: string, head: string | null): Promise<GitDiff> {
    this.comparisons.push({ base, head });
    return { patch: this.patch, truncated: this.truncated };
  }
}
