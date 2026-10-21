// @vitest-environment jsdom
import type { AgentDto, FleetEvent, ProjectDto, TaskNodeDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from './ProjectsPage';

vi.mock('../organizations/OrganizationContext', () => ({
  useCurrentOrganization: () => ({ id: 'org', name: 'Acme' }),
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  onopen: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {}
  emit(event: FleetEvent) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const DAY = 86_400_000;

const project = (id: string, name: string, extra: Partial<ProjectDto> = {}): ProjectDto => ({
  id,
  organizationId: 'org',
  name,
  description: '',
  workspacePath: `/work/${id}`,
  memberIds: ['a1', 'a2'],
  createdAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
  ...extra,
});

const agent = (id: string, name: string, collaboratorIds: string[] = []): AgentDto =>
  ({ id, name, role: 'dev', model: 'opus', effort: 'high', collaboratorIds }) as unknown as AgentDto;

const metrics = (totalTokens: number, durationMs = 0) => ({
  runs: 1,
  durationMs,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalTokens,
  costUsd: 0,
});

const node = (id: string, number: number, patch: Partial<TaskNodeDto> = {}): TaskNodeDto =>
  ({
    id,
    number,
    projectId: 'p1',
    parentTaskId: null,
    agentId: 'a1',
    title: `Titulo ${id}`,
    status: 'completed',
    createdAt: ago(number * DAY),
    startedAt: ago(number * DAY),
    finishedAt: ago(number * DAY - 90_000),
    metrics: metrics(1000, 60_000),
    children: [],
    ...patch,
  }) as TaskNodeDto;

const SUMMARY = {
  activeProjects: 0,
  activeProjectsWeeklyDelta: 0,
  activeTasks: 0,
  totalTasks: 0,
  completedTasks: 0,
  swarmAgentIds: [],
  totalTokens: 0,
  costUsd: 0,
};

let tree: TaskNodeDto[] = [];
let treeFetches = 0;

function stubFetch(projects: ProjectDto[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/organizations/org/projects') return json(projects);
      if (url === '/api/organizations/org/agents')
        return json([agent('a1', 'Ada', ['a2']), agent('a2', 'Linus', ['a1'])]);
      if (url === '/api/organizations/org/projects/telemetry')
        return json({ generatedAt: new Date().toISOString(), summary: SUMMARY, projects: [] });
      if (url.endsWith('/tasks')) {
        treeFetches += 1;
        return json(tree);
      }
      return new Response('{}', { status: 404 });
    }),
  );
}

const Where = () => <output data-testid="where">{useLocation().search}</output>;

const mount = (projects: ProjectDto[], initial = '/') => {
  stubFetch(projects);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[initial]}>
        <ProjectsPage />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const panel = async () => screen.findByRole('region', { name: /Inspección activa/ });

beforeEach(() => {
  FakeEventSource.instances = [];
  treeFetches = 0;
  vi.stubGlobal('EventSource', FakeEventSource);
  tree = [node('t1', 1, { title: 'Vieja' }), node('t2', 2), node('t3', 3), node('t4', 4), node('t5', 5)];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ProjectInspection', () => {
  it('shows the 3 most recent roots with tokens, subtasks and full-view link', async () => {
    tree = [
      node('t1', 1, { createdAt: ago(DAY) }),
      node('t2', 2, { createdAt: ago(2 * DAY) }),
      node('t3', 3, { createdAt: ago(3 * DAY) }),
      node('t4', 4, { createdAt: ago(4 * DAY) }),
      node('t0', 9, {
        createdAt: ago(1000),
        status: 'running',
        finishedAt: null,
        startedAt: ago(125_000),
        title: 'En marcha',
        children: [
          node('c1', 10, { parentTaskId: 't0', children: [node('g1', 11, { parentTaskId: 'c1' })] }),
        ],
      }),
    ];
    mount([project('p1', 'Task app')]);
    const view = within(await panel());
    expect(await view.findByText('En marcha')).toBeTruthy();
    expect(view.getAllByRole('list', { name: 'Pila de ejecución reciente' })).toHaveLength(1);
    expect(view.getByText(/2 subtareas/)).toBeTruthy();
    expect(view.getByText(/2 min [4-6] s en curso/)).toBeTruthy();
    expect(view.getByText('Tarea 9').getAttribute('href')).toBe('/projects/p1/tasks/t0');
    expect(view.getByText(/Mostrando las 3 tareas más recientes de 7/)).toBeTruthy();
    expect(view.getByRole('link', { name: 'Abrir vista completa de tareas' }).getAttribute('href')).toBe(
      '/projects/p1',
    );
    const grandchild = view.getByText('Tarea 11').closest('li');
    expect(grandchild?.getAttribute('data-depth')).toBe('2');
    expect(view.getByText('Tarea 10').closest('li')?.getAttribute('data-depth')).toBe('1');
  });

  it('shows the empty state without tasks', async () => {
    tree = [];
    mount([project('p1', 'Task app')]);
    expect(await within(await panel()).findByText('Este proyecto aún no tiene tareas.')).toBeTruthy();
  });

  it('toggles the inspected project through the URL and aria-pressed', async () => {
    mount([project('p1', 'Alfa'), project('p2', 'Beta')]);
    const first = await screen.findByRole('button', { name: 'Inspeccionar Alfa' });
    const second = screen.getByRole('button', { name: 'Inspeccionar Beta' });
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(second.getAttribute('aria-pressed')).toBe('false');
    expect(second.getAttribute('aria-controls')).toBe('project-inspection');
    await userEvent.click(second);
    expect(screen.getByTestId('where').textContent).toBe('?inspect=p2');
    expect(second.getAttribute('aria-pressed')).toBe('true');
    expect(await screen.findByRole('heading', { name: 'Inspección activa: Beta' })).toBeTruthy();
  });

  it('falls back to the first project on an invalid param and can inspect archived ones', async () => {
    mount([project('p1', 'Alfa')], '/?inspect=nope');
    expect(await screen.findByRole('heading', { name: 'Inspección activa: Alfa' })).toBeTruthy();
  });

  it('lists the topology with working/idle state and reacts to SSE events', async () => {
    tree = [node('t1', 1)];
    mount([project('p1', 'Task app')]);
    const view = within(await panel());
    const list = await view.findByRole('list', { name: 'Topología del enjambre como lista' });
    expect(view.getByText(/Topología del enjambre \(2 agentes\)/)).toBeTruthy();
    expect(list.textContent).toContain('Ada · dev · opus · idle · orquestador · delega en: Linus');
    expect(view.getByText('Nodo maestro: Ada')).toBeTruthy();

    const fetchesBefore = treeFetches;
    tree = [node('t1', 1, { status: 'running', agentId: 'a2', finishedAt: null })];
    FakeEventSource.instances
      .find((source) => source.url.includes('projectId=p1'))
      ?.emit({
        type: 'task.updated',
        projectId: 'p1',
        task: tree[0],
      } as unknown as FleetEvent);
    await waitFor(() => expect(treeFetches).toBeGreaterThan(fetchesBefore));
    await waitFor(() => expect(list.textContent).toContain('Linus · dev · opus · trabajando'));
  });

  it('collapses roots with the keyboard', async () => {
    tree = [
      node('t1', 1, { status: 'running', finishedAt: null, children: [node('c1', 2, { title: 'Hija' })] }),
    ];
    mount([project('p1', 'Task app')]);
    const toggle = await screen.findByRole('button', { name: /subtareas de Tarea 1/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses finished roots by default', async () => {
    tree = [node('t1', 1, { children: [node('c1', 2)] })];
    mount([project('p1', 'Task app')]);
    const toggle = await screen.findByRole('button', { name: /subtareas de Tarea 1/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows tokens per minute with its tooltip, and hides it without working time', async () => {
    tree = [node('t1', 1, { metrics: metrics(6000, 60_000) })];
    const { unmount } = mount([project('p1', 'Task app')]);
    const line = await screen.findByText(/Tokens por minuto: ~6 mil/);
    expect(line.getAttribute('title')).toBe('Media sobre el tiempo de trabajo de los agentes');
    unmount();
    tree = [node('t1', 1, { metrics: metrics(6000, 0) })];
    mount([project('p1', 'Task app')]);
    await screen.findByText('Titulo t1');
    expect(screen.queryByText(/Tokens por minuto/)).toBeNull();
  });
});
