import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_AGENT_SKILLS } from '@fleet/shared';
import { SkillsField } from './SkillsField';

const useSkills = vi.fn();
vi.mock('./agentQueries', () => ({ useSkills: () => useSkills() }));

const CATALOG = [
  { name: 'pdf', description: 'Work with PDFs' },
  { name: 'graphify', description: 'Build a graph' },
];
const render = (skills: string[]) =>
  renderToStaticMarkup(<SkillsField skills={skills} onChange={() => undefined} />);

describe('SkillsField (static render)', () => {
  beforeEach(() => useSkills.mockReturnValue({ data: CATALOG, isLoading: false, isError: false }));

  it('shows catalog skills with their description and checks the selected ones', () => {
    const html = render(['pdf']);
    expect(html).toContain('Work with PDFs');
    expect(html).toMatch(/<input[^>]*checked[^>]*>/);
    expect(html).toContain('aria-label="Quitar skill pdf"');
  });

  it('renders no chips list when nothing is selected', () => {
    expect(render([])).not.toContain('Skills seleccionadas');
  });

  it('flags skills that are not in the catalog', () => {
    expect(render(['code-review'])).toContain('no instalada');
  });

  it('disables the unchecked options once the cap is reached, and says why', () => {
    const full = Array.from({ length: MAX_AGENT_SKILLS }, (_, i) => `s${i}`);
    const html = render(full);
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(CATALOG.length);
    expect(html).toContain(String(MAX_AGENT_SKILLS));
  });

  it('keeps a catalog skill that is already selected enabled at the cap', () => {
    const full = ['pdf', ...Array.from({ length: MAX_AGENT_SKILLS - 1 }, (_, i) => `s${i}`)];
    const html = render(full);
    const pdfInput = html.match(/<input[^>]*>(?=<span><span[^>]*>pdf<)/)?.[0] ?? '';
    expect(pdfInput).toContain('checked');
    expect(pdfInput).not.toContain('disabled');
  });

  it('still lets the user add skills by name when the catalog cannot be loaded', () => {
    useSkills.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const html = render([]);
    expect(html).toContain('No se pudo cargar el catálogo');
    expect(html).toContain('Añadir');
  });

  it('explains an empty catalog', () => {
    useSkills.mockReturnValue({ data: [], isLoading: false, isError: false });
    expect(render([])).toContain('No hay skills instaladas');
  });
});
