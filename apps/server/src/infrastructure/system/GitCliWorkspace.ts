import { spawn } from 'node:child_process';
import type { GitCommitRef, GitFileChange } from '@fleet/shared';
import type { GitDiff, GitWorkspace } from '../../application/ports/GitWorkspace.js';

const GIT_TIMEOUT_MS = 15_000;
const MAX_NUMSTAT_BYTES = 16 * 1024 * 1024;
const SHA_PATTERN = /^[0-9a-f]{40,64}$/;

interface GitOutput {
  stdout: string;
  truncated: boolean;
}

/**
 * Reads a workspace's repository through the git CLI. Strictly read-only: only rev-parse,
 * symbolic-ref and diff run, with optional locks off so not even the index is refreshed.
 * No shell is involved; revisions are validated as full SHAs before reaching the command line.
 */
export class GitCliWorkspace implements GitWorkspace {
  async head(path: string): Promise<GitCommitRef | null> {
    const sha = await this.tryGit(path, ['rev-parse', '--verify', '-q', 'HEAD']);
    if (!sha || !SHA_PATTERN.test(sha.stdout.trim())) return null;
    const branch = await this.tryGit(path, ['symbolic-ref', '--short', '-q', 'HEAD']);
    return { sha: sha.stdout.trim(), branch: branch?.stdout.trim() || null };
  }

  /**
   * Uses `--numstat -z` with rename detection: a rename is `adds\tdels\t\0old\0new\0`, and the new
   * path is reported. Binary files show `-` counts, which become null.
   */
  async changedFiles(path: string, base: string, head: string | null): Promise<GitFileChange[]> {
    const args = ['diff', '--numstat', '-z', '-M', ...DIFF_FLAGS, ...revisions(base, head), '--'];
    const { stdout } = await this.git(path, args, MAX_NUMSTAT_BYTES);
    return parseNumstat(stdout);
  }

  async diff(path: string, base: string, head: string | null, maxBytes: number): Promise<GitDiff> {
    const args = ['diff', '-M', ...DIFF_FLAGS, ...revisions(base, head), '--'];
    const { stdout, truncated } = await this.git(path, args, maxBytes);
    return { patch: stdout, truncated };
  }

  private async tryGit(path: string, args: string[]): Promise<GitOutput | null> {
    try {
      return await this.git(path, args, 4096);
    } catch {
      return null;
    }
  }

  /** Runs git, keeping at most `maxBytes` of output (the process is stopped once exceeded). */
  private git(path: string, args: string[], maxBytes: number): Promise<GitOutput> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', ['-C', path, '--no-optional-locks', ...args], {
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      let stderr = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), GIT_TIMEOUT_MS);
      child.stdout.on('data', (chunk: Buffer) => {
        if (truncated) return;
        const room = maxBytes - size;
        chunks.push(chunk.subarray(0, room));
        size += Math.min(chunk.length, room);
        if (chunk.length > room) {
          truncated = true;
          child.kill('SIGKILL');
        }
      });
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 || truncated) {
          resolve({ stdout: Buffer.concat(chunks).toString('utf8'), truncated });
        } else {
          reject(new Error(`git ${args[0] ?? ''} failed (${code}): ${stderr.trim()}`));
        }
      });
    });
  }
}

const DIFF_FLAGS = ['--no-ext-diff', '--no-textconv', '--no-color'];

function revisions(base: string, head: string | null): string[] {
  for (const sha of [base, head]) {
    if (sha !== null && !SHA_PATTERN.test(sha)) throw new Error(`Invalid git revision: ${sha}`);
  }
  return head === null ? [base] : [base, head];
}

function parseNumstat(output: string): GitFileChange[] {
  const fields = output.split('\0');
  const files: GitFileChange[] = [];
  for (let index = 0; index < fields.length; index++) {
    const match = /^(\d+|-)\t(\d+|-)\t(.*)$/s.exec(fields[index] ?? '');
    if (!match) continue;
    const [, additions = '-', deletions = '-', inlinePath = ''] = match;
    const isRename = inlinePath === '';
    const path = isRename ? fields[index + 2] : inlinePath;
    if (isRename) index += 2;
    if (path) files.push({ path, additions: toCount(additions), deletions: toCount(deletions) });
  }
  return files;
}

const toCount = (value: string) => (value === '-' ? null : Number(value));
