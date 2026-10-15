import type { AgentDto, ProjectDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SegmentedControl } from '../../components/ui';
import { ProjectMembers } from './ProjectMembers';

const project = (archivedAt: string | null): ProjectDto => ({
  id: 'p1',
  organizationId: 'o1',
  name: 'Demo',
  description: '',
  workspacePath: '/tmp/demo',
  memberIds: ['a1'],
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt,
});

const agents = [{ id: 'a1', name: 'Ada', role: 'CTO' }] as AgentDto[];

const render = (archivedAt: string | null) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ProjectMembers project={project(archivedAt)} agents={agents} />
    </QueryClientProvider>,
  );

describe('ProjectMembers (static render)', () => {
  it('offers member editing on active projects', () => {
    expect(render(null)).toMatch(/<button[^>]*>Editar<\/button>/);
  });

  it('hides member editing but keeps the member list on archived projects', () => {
    const html = render('2026-02-01T00:00:00.000Z');

    expect(html).not.toContain('Editar');
    expect(html).toContain('Ada');
  });
});

describe('SegmentedControl (static render)', () => {
  const html = renderToStaticMarkup(
    <SegmentedControl
      label="Filtrar proyectos"
      options={[
        { value: 'active', label: 'Activos (2)' },
        { value: 'archived', label: 'Archivados (1)' },
      ]}
      value="archived"
      onChange={() => undefined}
    />,
  );

  it('is a labelled radiogroup exposing the counters and the checked option', () => {
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Filtrar proyectos"');
    expect(html).toMatch(/aria-checked="false"[^>]*>Activos \(2\)/);
    expect(html).toMatch(/aria-checked="true"[^>]*>Archivados \(1\)/);
  });

  // QA-W1: radio role without roving tabindex (tabindex=-1 on unchecked) / arrow-key support.
  it.fails('uses a roving tabindex so only the checked radio is in the tab order', () => {
    expect(html).toContain('tabindex="-1"');
  });
});
