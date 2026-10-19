import type { AgentDto, ProjectDto } from '@fleet/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ProjectTable } from './ProjectTable';

const project: ProjectDto = {
  id: 'p1',
  organizationId: 'org',
  name: 'Task app',
  description: 'La app',
  workspacePath: '/work/task_app',
  memberIds: ['a1', 'a2', 'a3', 'a4', 'a5'],
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
};
const agents = ['Conde', 'Acosa', 'Lara', 'Vega', 'Arbeiza'].map(
  (name, index) => ({ id: `a${index + 1}`, name }) as AgentDto,
);

const render = (projects: ProjectDto[]) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ProjectTable projects={projects} agents={agents} />
    </MemoryRouter>,
  );

describe('ProjectTable', () => {
  it('is a real table with column headers, a project link and capped team chips', () => {
    const html = render([project]);
    expect(html).toContain('<table');
    expect(html).toContain('scope="col"');
    expect(html).toContain('href="/projects/p1"');
    expect(html).toContain('5 agentes');
    expect(html).toContain('+1');
    expect(html).not.toContain('Arbeiza');
  });

  it('flags archived projects', () => {
    expect(render([{ ...project, archivedAt: '2026-02-01T00:00:00.000Z' }])).toContain('Archivado');
  });
});
