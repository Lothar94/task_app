// @vitest-environment jsdom
import type { AgentDto, ProjectDto, ProjectOperationalStatus, ProjectTelemetryDto } from '@fleet/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
const archived: ProjectDto = { ...project, archivedAt: '2026-02-01T00:00:00.000Z' };
const agents = ['Conde', 'Acosa', 'Lara', 'Vega', 'Arbeiza'].map(
  (name, index) => ({ id: `a${index + 1}`, name }) as AgentDto,
);

const telemetry = (patch: Partial<ProjectTelemetryDto> = {}): ProjectTelemetryDto => ({
  projectId: 'p1',
  status: 'idle',
  counts: { total: 10, completed: 6, active: 2, failed: 2, cancelled: 0, planned: 0 },
  successRate: 0.75,
  totalTokens: 12_400,
  costUsd: 1.5,
  agentTimeMs: 200_000,
  lastActivityAt: new Date(Date.now() - 9000).toISOString(),
  activeAgentIds: ['a1'],
  activeSubtask: null,
  alerts: [],
  ...patch,
});

const renderTable = (
  projects: ProjectDto[],
  data: ProjectTelemetryDto | undefined,
  options: {
    loading?: boolean;
    onResume?: () => void;
    inspectedId?: string | null;
    onInspect?: (project: ProjectDto) => void;
  } = {},
) =>
  render(
    <MemoryRouter>
      <ProjectTable
        projects={projects}
        agents={agents}
        telemetry={new Map(data ? [[data.projectId, data]] : [])}
        loading={options.loading}
        inspectedId={options.inspectedId ?? null}
        onInspect={options.onInspect ?? (() => undefined)}
        onResume={options.onResume ?? (() => undefined)}
      />
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('ProjectTable', () => {
  it('shows skeleton cells while the telemetry loads', () => {
    renderTable([project], undefined, { loading: true });
    expect(screen.getAllByText('Cargando…').length).toBeGreaterThan(0);
  });

  it('omits telemetry cells when the data is unavailable', () => {
    renderTable([project], undefined);
    expect(screen.queryByText('Cargando…')).toBeNull();
    expect(screen.queryByText(/tokens/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Task app' })).toBeTruthy();
  });

  it.each<[ProjectOperationalStatus, string]>([
    ['attention', 'Atención'],
    ['running', 'En curso'],
    ['resting', 'En reposo'],
    ['idle', 'Inactivo'],
  ])('shows the %s status chip', (status, label) => {
    renderTable([project], telemetry({ status, counts: { ...telemetry().counts, active: 0 } }));
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('tints the row of projects needing attention', () => {
    const { container } = renderTable([project], telemetry({ status: 'attention' }));
    expect(container.querySelector('tbody tr')?.className).toContain('bg-warning-soft');
  });

  it('shows counts, success rate, load and last activity', () => {
    renderTable([project], telemetry());
    expect(screen.getByText('10 tareas')).toBeTruthy();
    expect(screen.getByText(/75 % éxito|75% éxito/)).toBeTruthy();
    expect(screen.getByText('2 fallidas')).toBeTruthy();
    expect(screen.getByText(/12,4 mil tokens/)).toBeTruthy();
    expect(screen.getByText('3 min 20 s acumulados')).toBeTruthy();
    expect(screen.getByText(/hace 9 segundos/)).toBeTruthy();
  });

  it('renders the active subtask as a valid extra row with a trace link', () => {
    const activeSubtask = {
      taskId: 't9',
      taskNumber: 7,
      title: 'Migrar esquema',
      agentId: 'a2',
      agentName: 'Acosa',
      startedAt: new Date(Date.now() - 65_000).toISOString(),
    };
    const { container } = renderTable([project], telemetry({ status: 'running', activeSubtask }));
    const cell = container.querySelector('tbody tr:nth-child(2) > td');
    expect(cell?.getAttribute('colspan')).toBe('5');
    expect(cell?.textContent).toContain('Subtarea activa:');
    expect(cell?.textContent).toContain('#7 Migrar esquema');
    expect(cell?.textContent).toContain('Agente Acosa');
    expect(within(cell as HTMLElement).getByText(/1 min/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver traza en vivo' }).getAttribute('href')).toBe(
      '/projects/p1/tasks/t9',
    );
  });

  it('shows alert text and asks to resume without doing it', async () => {
    const onResume = vi.fn();
    renderTable(
      [project],
      telemetry({
        status: 'attention',
        alerts: [
          { kind: 'session_limit', taskIds: ['a', 'b'] },
          { kind: 'token_limit', taskIds: ['c'] },
        ],
      }),
      { onResume },
    );
    expect(screen.getByText('2 tareas con fallo de sesión')).toBeTruthy();
    expect(screen.getByText('Límite de tokens')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reanudar Task app' }));
    expect(onResume).toHaveBeenCalledWith(project);
  });

  it('offers no resume for archived projects, nor active subtasks', () => {
    renderTable(
      [archived],
      telemetry({
        alerts: [{ kind: 'session_limit', taskIds: ['a'] }],
        activeSubtask: {
          taskId: 't',
          taskNumber: 1,
          title: 'x',
          agentId: 'a1',
          agentName: 'Conde',
          startedAt: new Date().toISOString(),
        },
      }),
    );
    expect(screen.queryByRole('button', { name: /Reanudar/ })).toBeNull();
    expect(screen.queryByText('Subtarea activa:')).toBeNull();
    expect(screen.getByText('Archivado')).toBeTruthy();
    expect(screen.queryByText('Inactivo')).toBeNull();
  });

  it('is a real table with column headers, a project link and capped team chips', () => {
    renderTable([project], telemetry());
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByRole('columnheader').length).toBe(5);
    expect(screen.getByRole('link', { name: 'Task app' }).getAttribute('href')).toBe('/projects/p1');
    expect(screen.getByText('5 agentes')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.queryByText('Arbeiza')).toBeNull();
  });
});
