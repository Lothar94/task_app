import type { TaskExecutionDto, TaskGitContextDto } from '@fleet/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiffViewer } from './DiffView';
import { ExecutionMetricsBody } from './ExecutionMetrics';
import { GitContextBody } from './GitContextSection';
import { ResultActionsView } from './ResultActions';
import { TaskMetricsView } from './TaskPage';

const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
const execution = (patch: Partial<TaskExecutionDto> = {}): TaskExecutionDto => ({
  taskId: 't',
  own: { ...totals, totalTokens: 12_000, costUsd: 1.5, runs: 2, durationMs: 200_000 },
  subtree: { ...totals, totalTokens: 30_000, costUsd: 3, runs: 3, durationMs: 300_000 },
  time: { totalMs: 1000, llmMs: 500, toolMs: 300, ioMs: 200 },
  models: [{ model: 'opus', ...totals, costUsd: 1 }],
  primaryModel: 'opus',
  runs: [
    {
      number: 2,
      startedAt: '',
      finishedAt: '',
      durationMs: 1,
      outcome: 'failed',
      totalTokens: 1,
      costUsd: 0,
    },
  ],
  ...patch,
});
const html = (node: React.ReactNode) => renderToStaticMarkup(node);

describe('ExecutionMetricsBody', () => {
  it('shows tiles, subtree sub-line, primary model and time split as text', () => {
    const out = html(<ExecutionMetricsBody execution={execution()} />);

    expect(out).toContain('Tokens totales');
    expect(out).toContain('con árbol');
    expect(out).toContain('opus');
    expect(out).toContain('role="img"');
    expect(out).toContain('LLM 50%');
    expect(out).toContain('Herramientas');
  });

  it('lists models only when there are several', () => {
    const one = html(<ExecutionMetricsBody execution={execution()} />);
    const many = html(
      <ExecutionMetricsBody
        execution={execution({
          models: [
            { model: 'a', ...totals, costUsd: 1 },
            { model: 'b', ...totals, costUsd: 1 },
          ],
        })}
      />,
    );

    expect(one).not.toContain('Por modelo');
    expect(many).toContain('Por modelo');
  });

  it('shows the empty state without runs', () => {
    const empty = execution({ runs: [], own: { ...execution().own, runs: 0 } });

    expect(html(<ExecutionMetricsBody execution={empty} />)).toContain('Sin ejecuciones todavía.');
  });

  it('explains missing time data', () => {
    const out = html(<ExecutionMetricsBody execution={execution({ time: null })} />);

    expect(out).toContain('Sin datos de tiempo para estas ejecuciones.');
    expect(out).not.toContain('role="img"');
  });
});

describe('TaskMetricsView (header)', () => {
  it('shows duration, tokens with subtasks and the last run state', () => {
    const out = html(<TaskMetricsView task={{ status: 'failed' }} execution={execution()} />);

    expect(out).toContain('Duración:');
    expect(out).toContain('con subtareas');
    expect(out).toContain('#2 fallida');
  });

  it('shows "en curso" while running', () => {
    expect(html(<TaskMetricsView task={{ status: 'running' }} execution={execution()} />)).toContain(
      '#2 en curso',
    );
  });
});

const ok = (patch: Partial<Extract<TaskGitContextDto, { status: 'ok' }>> = {}): TaskGitContextDto => ({
  status: 'ok',
  taskId: 't',
  currentBranch: 'feature/x',
  base: { sha: '1234567890', branch: 'main' },
  head: { sha: 'abcdefabcdef', branch: 'feature/x' },
  files: [
    { path: 'src/deep/a.ts', additions: 3, deletions: 1 },
    { path: 'logo.png', additions: null, deletions: null },
  ],
  live: false,
  ...patch,
});

describe('GitContextBody', () => {
  it('shows branch, short shas, files with counts and bin', () => {
    const out = html(<GitContextBody git={ok()} />);

    expect(out).toContain('Rama activa');
    expect(out).toContain('1234567');
    expect(out).not.toContain('1234567890');
    expect(out).toContain('Archivos tocados: 2 modificados');
    expect(out).toContain('title="src/deep/a.ts"');
    expect(out).toContain('>a.ts<');
    expect(out).toContain('+3');
    expect(out).toContain('−1');
    expect(out).toContain('bin');
    expect(out).not.toContain('en vivo');
  });

  it('badges a live head', () => {
    expect(html(<GitContextBody git={ok({ live: true })} />)).toContain('en vivo');
  });

  it('shows the empty file state', () => {
    expect(html(<GitContextBody git={ok({ files: [] })} />)).toContain('Sin cambios entre base y head.');
  });

  it('explains not_a_repository', () => {
    expect(html(<GitContextBody git={{ status: 'not_a_repository', taskId: 't' }} />)).toContain(
      'no es un repositorio git',
    );
  });

  it('explains no_snapshot with the current branch', () => {
    const out = html(<GitContextBody git={{ status: 'no_snapshot', taskId: 't', currentBranch: 'dev' }} />);

    expect(out).toContain('Sin instantánea git');
    expect(out).toContain('dev');
  });
});

describe('ResultActionsView', () => {
  const view = (copyState: 'idle' | 'copied' | 'failed') =>
    html(<ResultActionsView fileCount={4} copyState={copyState} onCopy={() => {}} onOpenDiff={() => {}} />);

  it('renders both actions with the file count', () => {
    const out = view('idle');

    expect(out).toContain('Copiar PR');
    expect(out).toContain('Abrir diff (4 archivos)');
  });

  it('announces copy feedback in an aria-live region', () => {
    expect(view('copied')).toMatch(/aria-live="polite"[^>]*>Copiado</);
    expect(view('failed')).toContain('No se pudo copiar');
  });
});

describe('DiffViewer', () => {
  const patch = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new\n';

  it('renders per-file headers and signed lines', () => {
    const out = html(<DiffViewer diff={{ patch, truncated: false }} />);

    expect(out).toContain('a.ts');
    expect(out).toContain('-old');
    expect(out).toContain('+new');
    expect(out).toContain('text-success');
    expect(out).toContain('text-danger');
    expect(out).not.toContain('truncado');
  });

  it('shows the truncated notice', () => {
    expect(html(<DiffViewer diff={{ patch, truncated: true }} />)).toContain('Diff truncado');
  });

  it('shows an empty state for an empty patch', () => {
    expect(html(<DiffViewer diff={{ patch: '', truncated: false }} />)).toContain('Sin cambios');
  });
});
