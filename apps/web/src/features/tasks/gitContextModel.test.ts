import type { TaskGitContextDto } from '@fleet/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPullRequestText, copyToClipboard, fileName, isGitOk, shortSha } from './gitContextModel';

const git = {
  status: 'ok',
  taskId: 't',
  currentBranch: 'feature/x',
  base: { sha: 'aaaaaaaaaaaa', branch: 'main' },
  head: { sha: 'bbbbbbbbbbbb', branch: null },
  files: [
    { path: 'src/a.ts', additions: 3, deletions: 1 },
    { path: 'logo.png', additions: null, deletions: null },
  ],
  live: false,
} satisfies Extract<TaskGitContextDto, { status: 'ok' }>;

describe('git helpers', () => {
  it('shortens shas to 7 chars and paths to the basename', () => {
    expect(shortSha('abcdef0123456')).toBe('abcdef0');
    expect(fileName('a/b/c.ts')).toBe('c.ts');
    expect(fileName('c.ts')).toBe('c.ts');
  });

  it('narrows only the ok status', () => {
    expect(isGitOk(git)).toBe(true);
    expect(isGitOk({ status: 'not_a_repository', taskId: 't' })).toBe(false);
    expect(isGitOk(undefined)).toBe(false);
  });
});

describe('buildPullRequestText', () => {
  it('builds markdown with title, summary, branches and files', () => {
    const text = buildPullRequestText({ title: 'Arreglar login', resultSummary: 'Hecho.' }, git);

    expect(text).toContain('# Arreglar login');
    expect(text).toContain('Hecho.');
    expect(text).toContain('- Rama: feature/x');
    expect(text).toContain('- Base: `aaaaaaa` (main)');
    expect(text).toContain('- Head: `bbbbbbb`');
    expect(text).toContain('- `src/a.ts` +3 −1');
    expect(text).toContain('- `logo.png` bin');
  });

  it('handles missing summary and no files', () => {
    const text = buildPullRequestText({ title: 'T', resultSummary: null }, { ...git, files: [] });

    expect(text).toContain('Sin resumen.');
    expect(text).toContain('Sin cambios entre base y head.');
  });
});

describe('copyToClipboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports copied when the clipboard accepts the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    expect(await copyToClipboard('hola')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('hola');
  });

  it.each([
    ['rejects', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } }],
    ['is missing', {}],
  ])('reports failed when the clipboard %s', async (_name, nav) => {
    vi.stubGlobal('navigator', nav);

    expect(await copyToClipboard('hola')).toBe('failed');
  });
});
