import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitCliWorkspace } from '../../src/infrastructure/system/GitCliWorkspace.js';

let root: string;
let repo: string;
const workspace = new GitCliWorkspace();
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' };
const git = (...args: string[]) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', env }).trim();

let base: string;
let head: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'fleet-git-ro-'));
  repo = join(root, 'my repo; $(touch pwned) `x`');
  mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  writeFileSync(join(repo, 'a.txt'), 'a\n'.repeat(30));
  writeFileSync(join(repo, 'r.txt'), 'rename me\n'.repeat(20));
  git('add', '-A');
  git('-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
  base = git('rev-parse', 'HEAD');
  git('checkout', '-q', '-b', 'odd\'branch;$(id)"name');
  writeFileSync(join(repo, 'a.txt'), 'a\n'.repeat(10) + 'b\n'.repeat(5));
  writeFileSync(join(repo, 'bin.dat'), Buffer.from([0, 1, 0, 2]));
  git('mv', 'r.txt', 'renamed ü.txt');
  git('add', '-A');
  git('-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'work');
  head = git('rev-parse', 'HEAD');
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

function snapshot() {
  const index = join(repo, '.git', 'index');
  return {
    status: git('status', '--porcelain'),
    head: git('rev-parse', 'HEAD'),
    refs: git('for-each-ref'),
    indexBytes: readFileSync(index).toString('hex'),
    indexMtime: statSync(index).mtimeMs,
  };
}

describe('GitCliWorkspace read-only guarantees', () => {
  it('reports odd branch names verbatim and no branch when detached', async () => {
    expect((await workspace.head(repo))?.branch).toBe('odd\'branch;$(id)"name');
    git('checkout', '-q', '--detach', 'HEAD');
    expect((await workspace.head(repo))?.branch).toBeNull();
    git('checkout', '-q', '-');
  });

  it('keeps status, index bytes+mtime, refs and HEAD unchanged with dirty + untracked files, even detached', async () => {
    writeFileSync(join(repo, 'a.txt'), 'dirty\n');
    writeFileSync(join(repo, 'untracked.txt'), 'u\n');
    git('status', '--porcelain'); // settle stat info before measuring
    for (const detach of [false, true]) {
      if (detach) git('checkout', '-q', '--detach', 'HEAD');
      const before = snapshot();
      await new Promise((r) => setTimeout(r, 1100));
      await workspace.head(repo);
      await workspace.changedFiles(repo, base, null);
      await workspace.changedFiles(repo, base, head);
      await workspace.diff(repo, base, null, 1_000_000);
      await workspace.diff(repo, base, head, 50);
      expect(snapshot()).toEqual(before);
    }
    git('checkout', '-q', '-');
    git('checkout', '-q', '--', 'a.txt');
    rmSync(join(repo, 'untracked.txt'));
  });

  it('does not execute shell metacharacters from the workspace path', () => {
    expect(() => statSync(join(process.cwd(), 'pwned'))).toThrow();
    expect(() => statSync(join(repo, 'pwned'))).toThrow();
  });

  it('numstat matches real git diff --numstat', async () => {
    const files = await workspace.changedFiles(repo, base, head);
    const real = git('diff', '--numstat', '-M', base, head)
      .split('\n')
      .map((l) => l.split('\t'));
    expect(files).toHaveLength(real.length);
    const a = files.find((f) => f.path === 'a.txt');
    const [adds, dels] = real.find((r) => r[2] === 'a.txt') ?? [];
    expect(a).toMatchObject({ additions: Number(adds), deletions: Number(dels) });
    expect(files.find((f) => f.path === 'bin.dat')).toMatchObject({ additions: null, deletions: null });
    expect(files.find((f) => f.path === 'renamed ü.txt')).toBeDefined();
  });
});
