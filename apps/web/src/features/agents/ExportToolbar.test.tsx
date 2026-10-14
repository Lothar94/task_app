import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExportToolbar } from './ExportToolbar';

const render = (overrides: Partial<Parameters<typeof ExportToolbar>[0]> = {}) =>
  renderToStaticMarkup(
    <ExportToolbar
      selectedCount={0}
      includeCollaborators={false}
      isPending={false}
      error={null}
      onSelectAll={() => undefined}
      onSelectNone={() => undefined}
      onIncludeCollaboratorsChange={() => undefined}
      onExport={() => undefined}
      onCancel={() => undefined}
      {...overrides}
    />,
  );

describe('ExportToolbar (static render)', () => {
  it('disables the export button when nothing is selected', () => {
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>Exportar selección \(0\)/);
  });

  it('enables the export button and shows the count when agents are selected', () => {
    const html = render({ selectedCount: 3 });
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('Exportar selección (3)');
  });

  it('shows the pending state and disables export', () => {
    expect(render({ selectedCount: 2, isPending: true })).toMatch(/<button[^>]*disabled=""[^>]*>Exportando…/);
  });

  it('labels the collaborators checkbox and reflects its state', () => {
    const html = render({ includeCollaborators: true });
    expect(html).toMatch(/<input[^>]*checked[^>]*>\s*Incluir colaboradores/);
  });

  it('renders the error message', () => {
    expect(render({ error: new Error('Fallo al exportar') })).toContain('Fallo al exportar');
  });

  it('offers select all, none and cancel', () => {
    const html = render();
    for (const label of ['Seleccionar todos', 'Ninguno', 'Cancelar']) expect(html).toContain(label);
  });
});
