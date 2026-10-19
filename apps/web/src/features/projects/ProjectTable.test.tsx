import type { AgentDto, ProjectDto } from '@fleet/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { TaskNodeDto } from '@fleet/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectTable } from './ProjectTable';
import { type ProjectTelemetry, projectTelemetry } from './projectTelemetryModel';
import type { ProjectTelemetryState } from './useProjectTelemetry';

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
const failedTask = {
  status: 'failed',
  agentId: 'a1',
  createdAt: '2026-01-01T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  children: [],
  metrics: {
    runs: 1,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 10,
    costUsd: 0,
  },
} as unknown as TaskNodeDto;
const agents = ['Conde', 'Acosa', 'Lara', 'Vega', 'Arbeiza'].map(
  (name, index) => ({ id: `a${index + 1}`, name }) as AgentDto,
);

const ready = (telemetry: ProjectTelemetry): ProjectTelemetryState => ({ isPending: false, telemetry });
const healthy = projectTelemetry([]);
let telemetry = new Map<string, ProjectTelemetryState>();

const render = (projects: ProjectDto[]) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ProjectTable projects={projects} agents={agents} telemetry={telemetry} />
    </MemoryRouter>,
  );

describe('ProjectTable', () => {
  beforeEach(() => {
    telemetry = new Map();
  });

  it('shows skeleton cells while the telemetry loads', () => {
    telemetry.set('p1', { isPending: true });
    expect(render([project])).toContain('Cargando…');
  });

  it('omits telemetry cells when the data is unavailable', () => {
    telemetry.set('p1', { isPending: false });
    const html = render([project]);
    expect(html).not.toContain('Cargando…');
    expect(html).not.toContain('tokens');
  });

  it('shows the status chip and tints the row when tasks failed', () => {
    const failing = projectTelemetry([failedTask]);
    telemetry.set('p1', ready(failing));
    const html = render([project]);
    expect(html).toContain('Atención');
    expect(html).toContain('bg-warning-soft');
    expect(html).toContain('1 fallida');
    telemetry.set('p1', ready(healthy));
    expect(render([project])).toContain('Inactivo');
  });

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
