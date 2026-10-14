import type { AgentImportResultDto } from '@fleet/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseImportFile } from './agentImport';
import { ImportDialogView, type ImportDialogViewProps } from './ImportDialogView';

const valid = parseImportFile(
  JSON.stringify({
    format: 'agent-fleet/agents',
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    organization: 'Acme',
    agents: [{ name: 'Ana' }, { name: 'Luis' }],
  }),
);

const render = (overrides: Partial<ImportDialogViewProps> = {}) =>
  renderToStaticMarkup(
    <ImportDialogView
      parsed={null}
      conflicts={[]}
      strategy="fail"
      isPending={false}
      error={null}
      result={null}
      onFileChange={() => undefined}
      onStrategyChange={() => undefined}
      onSubmit={() => undefined}
      onClose={() => undefined}
      {...overrides}
    />,
  );

describe('ImportDialogView (static render)', () => {
  it('offers a json file input and disables import without a valid file', () => {
    const html = render();
    expect(html).toContain('accept=".json,application/json"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Importar/);
  });

  it('shows the preview and enables import for a valid file', () => {
    const html = render({ parsed: valid });
    expect(html).toContain('2 agentes');
    expect(html).toContain('Acme');
    expect(html).toContain('Luis');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Importar/);
    expect(html).not.toContain('<select');
  });

  it('shows a parse error as an alert and keeps import disabled', () => {
    const html = render({ parsed: parseImportFile('{no') });
    expect(html).toContain('role="alert"');
    expect(html).toContain('JSON válido');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Importar/);
  });

  it('marks conflicts and shows the strategy selector with the chosen option', () => {
    const html = render({ parsed: valid, conflicts: ['Ana'], strategy: 'skip' });
    expect(html).toContain('(ya existe)');
    expect(html).toContain('1 conflicto');
    expect(html).toContain('Cancelar si hay conflicto');
    expect(html).toContain('Renombrar');
    expect(html).toMatch(/<option value="skip" selected="">Omitir existentes/);
  });

  it('disables import while sending', () => {
    expect(render({ parsed: valid, isPending: true })).toMatch(/<button[^>]*disabled=""[^>]*>Importando…/);
  });

  it('shows API errors in an alert', () => {
    const html = render({ parsed: valid, error: new Error('Nombre duplicado') });
    expect(html).toMatch(/role="alert"[^>]*>Nombre duplicado/);
  });

  it('shows the result summary in a live region', () => {
    const result: AgentImportResultDto = {
      imported: [],
      skipped: ['Luis'],
      renamed: [{ from: 'Ana', to: 'Ana (2)' }],
    };
    const html = render({ result });
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Omitidos: Luis');
    expect(html).toContain('Ana → Ana (2)');
    expect(html).not.toContain('type="file"');
  });
});
