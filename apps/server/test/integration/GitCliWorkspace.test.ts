import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitCliWorkspace } from '../../src/infrastructure/system/GitCliWorkspace.js';

let root: string;
let repo: string;
const workspace = new GitCliWorkspace();

const git = (...args: string[]) =>
  execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' },
  }).trim();

function commitAll(message: string): string {
  git('add', '-A');
  git('-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
}

let base: string;
let head: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'fleet-git-'));
  repo = join(root, 'repo');
  mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  writeFileSync(join(repo, 'keep.txt'), 'one\ntwo\n');
  writeFileSync(join(repo, 'old name.txt'), 'rename me\n'.repeat(20));
  base = commitAll('base');
  git('checkout', '-q', '-b', 'feature');
  writeFileSync(join(repo, 'keep.txt'), 'one\ntwo\nthree\n');
  writeFileSync(join(repo, 'image.bin'), Buffer.from([0, 1, 2, 0, 255, 0]));
  git('mv', 'old name.txt', 'new name.txt');
  head = commitAll('work');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('GitCliWorkspace', () => {
  it('reads HEAD and branch, null branch when detached', async () => {
    expect(await workspace.head(repo)).toEqual({ sha: head, branch: 'feature' });
    git('checkout', '-q', '--detach', 'HEAD');
    expect(await workspace.head(repo)).toEqual({ sha: head, branch: null });
    git('checkout', '-q', 'feature');
  });

  it('is not a repository for missing directories, plain directories and empty repositories', async () => {
    const plain = join(root, 'plain');
    mkdirSync(plain);
    const empty = join(root, 'empty');
    mkdirSync(empty);
    execFileSync('git', ['-C', empty, 'init', '-q']);

    expect(await workspace.head(join(root, 'missing'))).toBeNull();
    expect(await workspace.head(plain)).toBeNull();
    expect(await workspace.head(empty)).toBeNull();
  });

  it('lists changes between commits with binary files as null and renames at the new path', async () => {
    const files = await workspace.changedFiles(repo, base, head);

    expect([...files].sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { path: 'image.bin', additions: null, deletions: null },
      { path: 'keep.txt', additions: 1, deletions: 0 },
      { path: 'new name.txt', additions: 0, deletions: 0 },
    ]);
  });

  it('diffs a commit range and truncates big patches', async () => {
    const full = await workspace.diff(repo, base, head, 1_000_000);
    const cut = await workspace.diff(repo, base, head, 50);

    expect(full.truncated).toBe(false);
    expect(full.patch).toContain('+three');
    expect(full.patch).toContain('rename to new name.txt');
    expect(cut.truncated).toBe(true);
    expect(Buffer.byteLength(cut.patch)).toBeLessThanOrEqual(50);
  });

  it('includes uncommitted changes of tracked files when comparing with the working tree', async () => {
    writeFileSync(join(repo, 'keep.txt'), 'one\ntwo\nthree\nfour\n');

    const files = await workspace.changedFiles(repo, head, null);
    const { patch } = await workspace.diff(repo, head, null, 100_000);

    expect(files).toEqual([{ path: 'keep.txt', additions: 1, deletions: 0 }]);
    expect(patch).toContain('+four');
    git('checkout', '-q', '--', 'keep.txt');
  });

  it('rejects revisions that are not full SHAs', async () => {
    await expect(workspace.changedFiles(repo, '--output=/tmp/x', null)).rejects.toThrow(
      'Invalid git revision',
    );
  });

  it('leaves the workspace and the index untouched', async () => {
    writeFileSync(join(repo, 'keep.txt'), 'touched\n');
    writeFileSync(join(repo, 'untracked.txt'), 'x\n');
    const indexFile = join(repo, '.git', 'index');
    const statusBefore = git('status', '--porcelain');
    const indexBefore = statSync(indexFile);

    await workspace.head(repo);
    await workspace.changedFiles(repo, base, null);
    await workspace.diff(repo, base, null, 100_000);

    const indexAfter = statSync(indexFile);
    expect(indexAfter.mtimeMs).toBe(indexBefore.mtimeMs);
    expect(indexAfter.size).toBe(indexBefore.size);
    expect(git('status', '--porcelain')).toBe(statusBefore);
    expect(git('rev-parse', 'HEAD')).toBe(head);
    git('checkout', '-q', '--', 'keep.txt');
    rmSync(join(repo, 'untracked.txt'));
  });
});
