// @vitest-environment jsdom
import type { AgentDto, ProjectDto, ProjectTelemetryDto, ProjectsTelemetryDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from './ProjectsPage';

vi.mock('../organizations/OrganizationContext', () => ({
  useCurrentOrganization: () => ({ id: 'org', name: 'Acme' }),
}));

class FakeEventSource {
  onmessage: unknown = null;
  onopen: unknown = null;
  close() {}
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;

const project = (id: string, name: string, extra: Partial<ProjectDto> = {}): ProjectDto => ({
  id,
  organizationId: 'org',
  name,
  description: '',
  workspacePath: `/work/${id}`,
  memberIds: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
  ...extra,
});

const agent = (id: string, name: string): AgentDto =>
  ({
    id,
    organizationId: 'org',
    name,
    role: 'dev',
    description: '',
    instructions: '',
  }) as unknown as AgentDto;

const telemetry = (projectId: string, extra: Partial<ProjectTelemetryDto> = {}): ProjectTelemetryDto => ({
  projectId,
  status: 'idle',
  counts: { total: 0, completed: 0, active: 0, failed: 0, cancelled: 0, planned: 0 },
  successRate: null,
  totalTokens: 0,
  costUsd: 0,
  agentTimeMs: 0,
  lastActivityAt: null,
  activeAgentIds: [],
  activeSubtask: null,
  alerts: [],
  ...extra,
});

interface Scenario {
  projects: ProjectDto[];
  items: ProjectTelemetryDto[];
  summary?: Partial<ProjectsTelemetryDto['summary']>;
  telemetryStatus?: number;
  resume?: { status: number; body: unknown };
}

const calls: { method: string; path: string }[] = [];
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch(scenario: Scenario) {
  const agents = [agent('a1', 'Ada'), agent('a2', 'Linus')];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { method?: string }) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, path: url });
      if (url === '/api/organizations/org/projects') return json(200, scenario.projects);
      if (url === '/api/organizations/org/agents') return json(200, agents);
      if (url === '/api/organizations/org/projects/telemetry') {
        if (scenario.telemetryStatus) return json(scenario.telemetryStatus, { error: 'boom' });
        return json(200, {
          generatedAt: new Date().toISOString(),
          summary: {
            activeProjects: 0,
            activeProjectsWeeklyDelta: 0,
            activeTasks: 0,
            totalTasks: 0,
            completedTasks: 0,
            swarmAgentIds: [],
            totalTokens: 0,
            costUsd: 0,
            ...scenario.summary,
          },
          projects: scenario.items,
        });
      }
      if (/\/api\/projects\/[^/]+\/resume$/.test(url) && method === 'POST') {
        const reply = scenario.resume ?? { status: 200, body: { resumedTaskIds: [] } };
        return json(reply.status, reply.body);
      }
      return json(404, { error: 'not found' });
    }),
  );
}

const mount = (scenario: Scenario) => {
  stubFetch(scenario);
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const resumePosts = () => calls.filter((call) => call.method === 'POST' && call.path.endsWith('/resume'));
const rowNames = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
    .filter((text) => /^Proj /.test(text));

const withAlert = telemetry('p1', {
  status: 'attention',
  counts: { total: 4, completed: 2, active: 0, failed: 2, cancelled: 0, planned: 0 },
  alerts: [{ kind: 'session_limit', taskIds: ['t1', 't2'] }],
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ProjectsPage QA - criterion 3 (UI resume flow)', () => {
  const alertScenario = (): Scenario => ({
    projects: [project('p1', 'Proj One'), project('p2', 'Proj Two')],
    items: [withAlert, telemetry('p2')],
  });

  it('opens the dialog on "Reanudar" without POSTing', async () => {
    const user = userEvent.setup();
    mount(alertScenario());
    await user.click(await screen.findByRole('button', { name: 'Reanudar Proj One' }));
    expect(
      await screen.findByText('Se volverán a poner en cola, al final de la cola, estas tareas fallidas:'),
    ).toBeTruthy();
    expect(resumePosts()).toHaveLength(0);
  });

  it('cancel never POSTs and closes the dialog', async () => {
    const user = userEvent.setup();
    mount(alertScenario());
    await user.click(await screen.findByRole('button', { name: 'Reanudar Proj One' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText(/estas tareas fallidas/)).toBeNull());
    expect(resumePosts()).toHaveLength(0);
  });

  it('Escape closes the dialog without POSTing', async () => {
    const user = userEvent.setup();
    mount(alertScenario());
    await user.click(await screen.findByRole('button', { name: 'Reanudar Proj One' }));
    const dialog = document.querySelector('dialog')!;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog.dispatchEvent(new Event('close'));
    expect(resumePosts()).toHaveLength(0);
  });

  it('confirm POSTs exactly once to the right project', async () => {
    const user = userEvent.setup();
    mount(alertScenario());
    await user.click(await screen.findByRole('button', { name: 'Reanudar Proj One' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar reanudación' }));
    await waitFor(() => expect(resumePosts()).toHaveLength(1));
    expect(resumePosts()[0]).toEqual({ method: 'POST', path: '/api/projects/p1/resume' });
    await waitFor(() => expect(screen.queryByText(/estas tareas fallidas/)).toBeNull());
    expect(resumePosts()).toHaveLength(1);
  });

  it('shows the API error inside the dialog and keeps it open', async () => {
    const user = userEvent.setup();
    mount({ ...alertScenario(), resume: { status: 409, body: { error: 'Ya hay una ejecución en curso' } } });
    await user.click(await screen.findByRole('button', { name: 'Reanudar Proj One' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar reanudación' }));
    expect(await screen.findByText(/Ya hay una ejecución en curso/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirmar reanudación' })).toBeTruthy();
  });

  it('has no resume button for projects without alerts', async () => {
    mount(alertScenario());
    await screen.findByRole('button', { name: 'Reanudar Proj One' });
    expect(screen.queryByRole('button', { name: 'Reanudar Proj Two' })).toBeNull();
  });

  it('has no resume button for archived projects even with alerts', async () => {
    const user = userEvent.setup();
    mount({
      projects: [
        project('p1', 'Proj One', { archivedAt: '2026-10-10T00:00:00.000Z' }),
        project('p2', 'Proj Two'),
      ],
      items: [withAlert, telemetry('p2')],
    });
    await user.click(await screen.findByRole('tab', { name: /Archivados/ }));
    await screen.findByText('Proj One');
    expect(screen.queryByRole('button', { name: /Reanudar/ })).toBeNull();
  });
});

describe('ProjectsPage QA - criterion 4 (list content)', () => {
  it('renders the four status chips', async () => {
    mount({
      projects: [
        project('p1', 'Proj A'),
        project('p2', 'Proj B'),
        project('p3', 'Proj C'),
        project('p4', 'Proj D'),
      ],
      items: [
        telemetry('p1', { status: 'attention' }),
        telemetry('p2', { status: 'running' }),
        telemetry('p3', { status: 'resting' }),
        telemetry('p4', { status: 'idle' }),
      ],
    });
    for (const label of ['Atención', 'En curso', 'En reposo', 'Inactivo']) {
      expect(await screen.findByText(label, { selector: 'span' })).toBeTruthy();
    }
  });

  it('shows % éxito, progress bar label, tokens, acumulados and "hace"', async () => {
    mount({
      projects: [project('p1', 'Proj A')],
      items: [
        telemetry('p1', {
          status: 'resting',
          counts: { total: 4, completed: 3, active: 0, failed: 1, cancelled: 0, planned: 0 },
          successRate: 0.75,
          totalTokens: 12_500,
          costUsd: 1.5,
          agentTimeMs: 200_000,
          lastActivityAt: ago(5 * MIN),
        }),
      ],
    });
    expect(await screen.findByText(/75\s?% éxito/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /75\s?% completadas/ })).toBeTruthy();
    expect(screen.getByText(/^\d.* tokens$/).textContent).toMatch(/12[.,]5|13/);
    expect(screen.getByText('3 min 20 s acumulados')).toBeTruthy();
    expect(screen.getByText(/^hace 5 minutos$/)).toBeTruthy();
  });

  it('shows the active subtask row with a link to the live task trace', async () => {
    mount({
      projects: [project('p1', 'Proj A')],
      items: [
        telemetry('p1', {
          status: 'running',
          counts: { total: 1, completed: 0, active: 1, failed: 0, cancelled: 0, planned: 0 },
          activeSubtask: {
            taskId: 'task-9',
            taskNumber: 7,
            title: 'Fix login',
            agentId: 'a1',
            agentName: 'Ada',
            startedAt: ago(90_000),
          },
        }),
      ],
    });
    expect(await screen.findByText('Subtarea activa:')).toBeTruthy();
    expect(screen.getByText('#7 Fix login')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Ver traza en vivo' });
    expect(link.getAttribute('href')).toBe('/projects/p1/tasks/task-9');
  });
});

describe('ProjectsPage QA - criterion 4 (tiles, tabs, filter, sort)', () => {
  it('renders the four summary tiles', async () => {
    mount({
      projects: [project('p1', 'Proj A')],
      items: [telemetry('p1')],
      summary: {
        activeProjects: 5,
        activeProjectsWeeklyDelta: 2,
        activeTasks: 3,
        totalTasks: 20,
        completedTasks: 12,
        swarmAgentIds: ['a1', 'a2'],
        totalTokens: 2_000_000,
        costUsd: 12.34,
      },
    });
    expect(await screen.findByText('+2 esta semana')).toBeTruthy();
    expect(screen.getByText('20 totales (12 completadas)')).toBeTruthy();
    expect(screen.getByText('Ada, Linus')).toBeTruthy();
    expect(screen.getByText(/~.*12,34.* USD/)).toBeTruthy();
    expect(screen.getByText(/2\s?M/)).toBeTruthy();
  });

  it('hides the weekly delta when it is 0', async () => {
    mount({ projects: [project('p1', 'Proj A')], items: [telemetry('p1')] });
    await screen.findByText('Tareas en curso');
    await waitFor(() => expect(screen.getByText(/0 totales \(0 completadas\)/)).toBeTruthy());
    expect(screen.queryByText(/esta semana/)).toBeNull();
  });

  it('shows tab counts for Activos / Archivados / Con alertas', async () => {
    mount({
      projects: [
        project('p1', 'Proj One'),
        project('p2', 'Proj Two'),
        project('p3', 'Proj Three', { archivedAt: '2026-10-10T00:00:00.000Z' }),
      ],
      items: [withAlert, telemetry('p2'), telemetry('p3')],
    });
    const tabs = await screen.findAllByRole('tab');
    const text = (name: RegExp) => tabs.find((tab) => name.test(tab.textContent ?? ''))?.textContent;
    expect(text(/Activos/)).toMatch(/2/);
    expect(text(/Archivados/)).toMatch(/1/);
    await waitFor(() => expect(text(/Con alertas/)).toMatch(/1/));
  });

  it('filters by name and by path, case-insensitively, with an empty message', async () => {
    const user = userEvent.setup();
    mount({
      projects: [
        project('p1', 'Proj Alpha', { workspacePath: '/srv/Frontend' }),
        project('p2', 'Proj Beta', { workspacePath: '/srv/backend' }),
      ],
      items: [telemetry('p1'), telemetry('p2')],
    });
    const box = await screen.findByLabelText('Filtrar por nombre o ruta');
    await user.type(box, 'ALPHA');
    expect(rowNames()).toEqual(['Proj Alpha']);
    await user.clear(box);
    await user.type(box, 'BACKEND');
    expect(rowNames()).toEqual(['Proj Beta']);
    await user.clear(box);
    await user.type(box, 'zzz');
    expect(screen.getByText('Ningún proyecto coincide con «zzz».')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('sorts by Reciente, Nombre and Consumo', async () => {
    const user = userEvent.setup();
    mount({
      projects: [project('p1', 'Proj B'), project('p2', 'Proj A'), project('p3', 'Proj C')],
      items: [
        telemetry('p1', { lastActivityAt: ago(MIN), totalTokens: 10 }),
        telemetry('p2', { lastActivityAt: ago(60 * MIN), totalTokens: 500 }),
        telemetry('p3', { lastActivityAt: null, totalTokens: 100 }),
      ],
    });
    const select = await screen.findByLabelText('Ordenar por');
    await waitFor(() => expect(rowNames()).toEqual(['Proj B', 'Proj A', 'Proj C']));
    await user.selectOptions(select, 'Nombre');
    expect(rowNames()).toEqual(['Proj A', 'Proj B', 'Proj C']);
    await user.selectOptions(select, 'Consumo');
    expect(rowNames()).toEqual(['Proj A', 'Proj C', 'Proj B']);
  });

  it('still renders projects with an inline error when telemetry fails', async () => {
    mount({ projects: [project('p1', 'Proj A')], items: [], telemetryStatus: 500 });
    expect(await screen.findByText(/No se pudo cargar la telemetría: boom/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Proj A' })).toBeTruthy();
    expect(within(screen.getByRole('table')).queryByText(/^\d.* tokens$/)).toBeNull();
  });
});
