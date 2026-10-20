import { GIT_DIFF_MAX_BYTES } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/domain/errors/DomainError.js';
import { GitScopeResolver } from '../../src/application/tasks/GitScope.js';
import { GetTaskGitContext, GetTaskGitDiff } from '../../src/application/tasks/QueryTaskGit.js';
import { TaskGitTracker } from '../../src/application/tasks/TaskGitTracker.js';
import type {
  TaskGitSnapshot,
  TaskGitSnapshotRepository,
} from '../../src/application/ports/TaskGitSnapshotRepository.js';
import { FakeGitWorkspace } from '../support/FakeGitWorkspace.js';

const WORKSPACE = '/work/project';
const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const LIVE = 'c'.repeat(40);

class MemorySnapshots implements TaskGitSnapshotRepository {
  readonly byTask = new Map<string, TaskGitSnapshot>();
  find = (taskId: string) => this.byTask.get(taskId) ?? null;
  save = (snapshot: TaskGitSnapshot) => void this.byTask.set(snapshot.taskId, snapshot);
}

function setup(taskStatus: string) {
  const git = new FakeGitWorkspace();
  const snapshots = new MemorySnapshots();
  const tasks = {
    findById: (id: string) => (id === 't1' ? { id, projectId: 'p1', status: taskStatus } : null),
  };
  const projects = { findById: () => ({ workspacePath: WORKSPACE }) };
  const scopes = new GitScopeResolver(tasks as never, projects as never, snapshots, git);
  return {
    git,
    snapshots,
    context: new GetTaskGitContext(scopes, git),
    diff: new GetTaskGitDiff(scopes, git),
  };
}

describe('GetTaskGitContext', () => {
  it('reports a workspace that is not a repository', async () => {
    const { context } = setup('completed');

    expect(await context.execute('t1')).toEqual({ status: 'not_a_repository', taskId: 't1' });
  });

  it('reports a repository where the task never ran', async () => {
    const { context, git } = setup('pending');
    git.heads.set(WORKSPACE, { sha: LIVE, branch: 'main' });

    expect(await context.execute('t1')).toEqual({
      status: 'no_snapshot',
      taskId: 't1',
      currentBranch: 'main',
    });
  });

  it('compares base with the stored head once the task is finished, files sorted by path', async () => {
    const { context, git, snapshots } = setup('completed');
    git.heads.set(WORKSPACE, { sha: LIVE, branch: 'other' });
    snapshots.save({
      taskId: 't1',
      base: { sha: BASE, branch: 'main' },
      head: { sha: HEAD, branch: 'feat' },
    });
    git.files = [
      { path: 'z.ts', additions: 1, deletions: 0 },
      { path: 'a.bin', additions: null, deletions: null },
    ];

    const result = await context.execute('t1');

    expect(result).toEqual({
      status: 'ok',
      taskId: 't1',
      currentBranch: 'other',
      base: { sha: BASE, branch: 'main' },
      head: { sha: HEAD, branch: 'feat' },
      files: [
        { path: 'a.bin', additions: null, deletions: null },
        { path: 'z.ts', additions: 1, deletions: 0 },
      ],
      live: false,
    });
    expect(git.comparisons).toEqual([{ base: BASE, head: HEAD }]);
  });

  it.each(['running', 'waiting_subtasks'])('uses the live HEAD and working tree while %s', async (status) => {
    const { context, git, snapshots } = setup(status);
    git.heads.set(WORKSPACE, { sha: LIVE, branch: 'main' });
    snapshots.save({ taskId: 't1', base: { sha: BASE, branch: 'main' }, head: null });

    const result = await context.execute('t1');

    expect(result).toMatchObject({ status: 'ok', live: true, head: { sha: LIVE, branch: 'main' } });
    expect(git.comparisons).toEqual([{ base: BASE, head: null }]);
  });

  it('falls back to the base when a finished task has no stored head', async () => {
    const { context, git, snapshots } = setup('failed');
    git.heads.set(WORKSPACE, { sha: LIVE, branch: 'main' });
    snapshots.save({ taskId: 't1', base: { sha: BASE, branch: 'main' }, head: null });

    expect(await context.execute('t1')).toMatchObject({ head: { sha: BASE }, live: false });
  });

  it('fails for unknown tasks', async () => {
    await expect(setup('completed').context.execute('nope')).rejects.toThrow('not found');
  });
});

describe('GetTaskGitDiff', () => {
  it('returns the patch of the same scope, capped at the contract size', async () => {
    const { diff, git, snapshots } = setup('completed');
    git.heads.set(WORKSPACE, { sha: LIVE, branch: 'main' });
    snapshots.save({
      taskId: 't1',
      base: { sha: BASE, branch: 'main' },
      head: { sha: HEAD, branch: 'main' },
    });
    git.patch = 'diff --git a/x b/x';
    git.truncated = true;

    expect(await diff.execute('t1')).toEqual({
      taskId: 't1',
      baseSha: BASE,
      headSha: HEAD,
      patch: 'diff --git a/x b/x',
      truncated: true,
    });
    expect(GIT_DIFF_MAX_BYTES).toBeGreaterThan(0);
  });

  it('diffs against the working tree while running', async () => {
    const { diff, git, snapshots } = setup('running');
    git.heads.set(WORKSPACE, { sha: LIVE, branch: 'main' });
    snapshots.save({ taskId: 't1', base: { sha: BASE, branch: 'main' }, head: null });

    expect(await diff.execute('t1')).toMatchObject({ baseSha: BASE, headSha: null });
  });

  it('conflicts when there is no git context', async () => {
    await expect(setup('completed').diff.execute('t1')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('TaskGitTracker', () => {
  const logs: unknown[] = [];
  const logger = { info: () => undefined, error: (_m: string, e: unknown) => void logs.push(e) };

  it('keeps the first base and replaces the head on every run', async () => {
    const git = new FakeGitWorkspace();
    const snapshots = new MemorySnapshots();
    const tracker = new TaskGitTracker(git, snapshots, logger);
    git.heads.set(WORKSPACE, { sha: BASE, branch: 'main' });
    await tracker.captureBase('t1', WORKSPACE);
    git.heads.set(WORKSPACE, { sha: HEAD, branch: 'main' });
    await tracker.captureBase('t1', WORKSPACE);
    await tracker.captureHead('t1', WORKSPACE);

    expect(snapshots.find('t1')).toEqual({
      taskId: 't1',
      base: { sha: BASE, branch: 'main' },
      head: { sha: HEAD, branch: 'main' },
    });
  });

  it('swallows git failures and logs them', async () => {
    const git = new FakeGitWorkspace();
    git.failWith = new Error('boom');
    const tracker = new TaskGitTracker(git, new MemorySnapshots(), logger);

    await expect(tracker.captureBase('t1', WORKSPACE)).resolves.toBeUndefined();
    await expect(tracker.captureHead('t1', WORKSPACE)).resolves.toBeUndefined();
    expect(logs).toHaveLength(1);
  });
});
