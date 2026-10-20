// @vitest-environment jsdom
import type { AgentDto, FleetEvent, ProjectDto, TaskNodeDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsPage } from './ProjectsPage';

vi.mock('../organizations/OrganizationContext', () => ({
  useCurrentOrganization: () => ({ id: 'org', name: 'Acme' }),
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emit(event: FleetEvent) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }
}
const open = () => FakeEventSource.instances.filter((source) => !source.closed);

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
  ({ id, name, role: `rol-${name}`, model: 'opus', effort: 'high', collaboratorIds }) as unknown as AgentDto;

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

let trees: Record<string, TaskNodeDto[]> = {};
let agents: AgentDto[] = [];

function stubFetch(projects: ProjectDto[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/organizations/org/projects') return json(projects);
      if (url === '/api/organizations/org/agents') return json(agents);
      if (url === '/api/organizations/org/projects/telemetry')
        return json({ generatedAt: new Date().toISOString(), summary: SUMMARY, projects: [] });
      const match = /\/projects\/([^/]+)\/tasks$/.exec(url);
      if (match) return json(trees[match[1] ?? ''] ?? []);
      return new Response('{}', { status: 404 });
    }),
  );
}

const Where = () => {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
};

const mount = (projects: ProjectDto[], initial = '/') => {
  stubFetch(projects);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="*" element={<p>otra ruta</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const panel = async () => within(await screen.findByRole('region', { name: /Inspección activa/ }));
const heading = (name: string) => screen.findByRole('heading', { name: `Inspección activa: ${name}` });

beforeEach(() => {
  FakeEventSource.instances = [];
  agents = [agent('a1', 'Ada', ['a2']), agent('a2', 'Linus', ['a1'])];
  trees = { p1: [], p2: [] };
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('criterion 1: selection and fallback', () => {
  it('falls back to the first visible project when the filter hides the inspected one', async () => {
    mount([project('p1', 'Alfa'), project('p2', 'Beta', { archivedAt: '2026-10-02T00:00:00.000Z' })], '/?inspect=p1');
    await heading('Alfa');
    await userEvent.click(screen.getByRole('tab', { name: /Archivados/ }));
    await heading('Beta');
    expect(screen.queryByRole('heading', { name: 'Inspección activa: Alfa' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Inspeccionar Beta' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('falls back when the search hides the inspected project, and shows no panel when nothing matches', async () => {
    mount([project('p1', 'Alfa'), project('p2', 'Beta')], '/?inspect=p1');
    await heading('Alfa');
    const search = screen.getByRole('searchbox', { name: 'Filtrar por nombre o ruta' });
    await userEvent.type(search, 'Beta');
    await heading('Beta');
    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    await waitFor(() => expect(screen.queryByRole('region', { name: /Inspección activa/ })).toBeNull());
  });

  it('keeps URL inspect param after filtering back (inspected project visible again)', async () => {
    mount([project('p1', 'Alfa'), project('p2', 'Beta')], '/?inspect=p2');
    await heading('Beta');
    const search = screen.getByRole('searchbox', { name: 'Filtrar por nombre o ruta' });
    await userEvent.type(search, 'Alfa');
    await heading('Alfa');
    await userEvent.clear(search);
    await heading('Beta');
  });
});

describe('criterion 2: execution stack', () => {
  it('orders roots by createdAt desc regardless of number, indents all depths, counts T incl. subtasks', async () => {
    trees.p1 = [
      node('old', 9, { createdAt: ago(10 * DAY) }),
      node('mid', 1, { createdAt: ago(5 * DAY) }),
      node('new', 2, {
        createdAt: ago(1 * DAY),
        status: 'running',
        finishedAt: null,
        children: [
          node('c1', 3, { children: [node('c2', 4, { children: [node('c3', 5, { title: 'Nieta profunda' })] })] }),
        ],
      }),
      node('older', 3, { createdAt: ago(20 * DAY) }),
    ];
    mount([project('p1', 'Alfa')]);
    const view = await panel();
    const stack = await view.findByRole('list', { name: 'Pila de ejecución reciente' });
    const rootTitles = within(stack)
      .getAllByText(/^Titulo (old|mid|new|older)$/)
      .map((element) => element.textContent);
    expect(rootTitles).toEqual(['Titulo new', 'Titulo mid', 'Titulo old']);
    expect(view.getByText('Mostrando las 3 tareas más recientes de 7')).toBeTruthy();
    const depths = Array.from(stack.querySelectorAll('[data-depth]')).map((li) => li.getAttribute('data-depth'));
    expect(depths).toEqual(['1', '2', '3']);
    expect(view.getByText('Nieta profunda')).toBeTruthy();
    expect(view.getByRole('link', { name: 'Abrir vista completa de tareas' }).getAttribute('href')).toBe(
      '/projects/p1',
    );
    expect(view.getAllByRole('link', { name: 'Tarea 2' })[0]?.getAttribute('href')).toBe('/projects/p1/tasks/new');
    expect(view.getByRole('link', { name: 'Tarea 5' }).getAttribute('href')).toBe('/projects/p1/tasks/c3');
  });

  it('shows live ticking duration for active tasks and fixed one for finished', async () => {
    trees.p1 = [
      node('run', 2, { status: 'running', startedAt: ago(5_000), finishedAt: null }),
      node('done', 1, { startedAt: ago(DAY), finishedAt: ago(DAY - 125_000) }),
    ];
    mount([project('p1', 'Alfa')]);
    const view = await panel();
    const readLive = async () => (await view.findByText(/en curso/)).textContent;
    const first = await readLive();
    await waitFor(async () => expect(await readLive()).not.toBe(first), { timeout: 3500 });
    const done = view.getByText('Titulo done').closest('li');
    expect(done?.textContent).not.toContain('en curso');
    expect(done?.textContent).toContain('2 min 5 s');
  });

  it('shows no duration for a task that never started', async () => {
    trees.p1 = [node('draft', 1, { status: 'queued', startedAt: null, finishedAt: null })];
    mount([project('p1', 'Alfa')]);
    const view = await panel();
    const row = (await view.findByText('Titulo draft')).closest('li');
    expect(row?.textContent).not.toMatch(/en curso|NaN|\d+s\b/);
  });

  it('shows an agent fallback for a task of an unknown agent', async () => {
    trees.p1 = [node('x', 1, { agentId: 'ghost' })];
    mount([project('p1', 'Alfa')]);
    expect(await (await panel()).findByText(/Agente desconocido/)).toBeTruthy();
  });

  it('shows the empty state and singular/zero counts', async () => {
    mount([project('p1', 'Alfa')]);
    const view = await panel();
    expect(await view.findByText('Este proyecto aún no tiene tareas.')).toBeTruthy();
    expect(view.getByText('Mostrando las 0 tareas más recientes de 0')).toBeTruthy();
  });
});

describe('criterion 3 & 5: topology and keyboard', () => {
  it('renders members only, with role/model/state, orchestrator and cycle edges dashed', async () => {
    agents = [agent('a1', 'Ada', ['a2']), agent('a2', 'Linus', ['a1']), agent('a3', 'Ajeno', ['a1'])];
    trees.p1 = [node('t1', 1, { status: 'running', agentId: 'a2', finishedAt: null })];
    const { container } = mount([project('p1', 'Alfa')]);
    const view = await panel();
    const linus = await view.findByRole('link', { name: /Linus, rol-Linus, orquestador, trabajando/ });
    expect(linus.textContent).toContain('opus');
    expect(view.getByRole('link', { name: 'Ada, rol-Ada, idle' })).toBeTruthy();
    expect(view.queryByText('Ajeno')).toBeNull();
    expect(view.getByText('Topología del enjambre (2 agentes)')).toBeTruthy();
    expect(container.querySelectorAll('svg [stroke-dasharray]').length).toBeGreaterThan(0);
  });

  it('navigates to /agents/:id with Enter on a focused node', async () => {
    mount([project('p1', 'Alfa')]);
    const view = await panel();
    const node = await view.findByRole('link', { name: /^Ada,/ });
    node.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where').textContent).toBe('/agents/a1');
  });

  it('list alternative exposes name, role, model, state, orquestador and members-only delegation', async () => {
    agents = [agent('a1', 'Ada', ['a2', 'a3', 'a1']), agent('a2', 'Linus'), agent('a3', 'Ajeno')];
    mount([project('p1', 'Alfa', { memberIds: ['a1', 'a2'] })]);
    const view = await panel();
    const list = await view.findByRole('list', { name: 'Topología del enjambre como lista' });
    const items = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('Ada · rol-Ada · opus · idle');
    expect(items[0]).toContain('orquestador');
    expect(items[0]).toContain('delega en: Linus');
    expect(items[0]).not.toContain('Ajeno');
  });

  it('self-referencing collaborator does not crash the panel', async () => {
    agents = [agent('a1', 'Ada', ['a1']), agent('a2', 'Linus')];
    mount([project('p1', 'Alfa')]);
    const view = await panel();
    expect(await view.findByRole('list', { name: 'Topología del enjambre como lista' })).toBeTruthy();
  });

  it('project without members: 0 agents, no master node, no crash', async () => {
    mount([project('p1', 'Alfa', { memberIds: [] })]);
    const view = await panel();
    expect(await view.findByText('Topología del enjambre (0 agentes)')).toBeTruthy();
    expect(view.queryByText(/Nodo maestro/)).toBeNull();
  });

  it('task of a non-member agent does not mark any member as working', async () => {
    agents = [agent('a1', 'Ada'), agent('a2', 'Linus'), agent('a3', 'Ajeno')];
    trees.p1 = [node('t1', 1, { status: 'running', agentId: 'a3', finishedAt: null })];
    mount([project('p1', 'Alfa')]);
    const view = await panel();
    const list = await view.findByRole('list', { name: 'Topología del enjambre como lista' });
    expect(list.textContent).not.toContain('trabajando');
    expect(view.getByText(/Nodo maestro: (Ada|Linus)/)).toBeTruthy();
  });

  it('collapse button wires aria-controls to an existing list', async () => {
    trees.p1 = [node('t1', 1, { children: [node('c1', 2)] })];
    mount([project('p1', 'Alfa')]);
    const toggle = await screen.findByRole('button', { name: /subtareas de Tarea 1/ });
    const target = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(target?.hidden).toBe(true);
    toggle.focus();
    await userEvent.keyboard(' ');
    expect(target?.hidden).toBe(false);
  });
});

describe('criterion 4: SSE', () => {
  it('toggles idle/trabajando on task.created and task.updated, and closes the source on switch/unmount', async () => {
    trees.p1 = [];
    trees.p2 = [];
    const { unmount } = mount([project('p1', 'Alfa'), project('p2', 'Beta')]);
    const view = await panel();
    const list = await view.findByRole('list', { name: 'Topología del enjambre como lista' });
    expect(list.textContent).not.toContain('trabajando');
    const source = open().find((s) => s.url.includes('projectId=p1'));
    expect(source).toBeTruthy();

    const running = node('t1', 1, { status: 'running', agentId: 'a2', finishedAt: null });
    trees.p1 = [running];
    source?.emit({ type: 'task.created', projectId: 'p1', task: running } as unknown as FleetEvent);
    await waitFor(() => expect(list.textContent).toContain('Linus · rol-Linus · opus · trabajando'));
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Linus, .*trabajando/ }).length).toBe(1));

    const done = node('t1', 1);
    trees.p1 = [done];
    source?.emit({ type: 'task.updated', projectId: 'p1', task: done } as unknown as FleetEvent);
    await waitFor(() => expect(list.textContent).not.toContain('trabajando'));

    await userEvent.click(screen.getByRole('button', { name: 'Inspeccionar Beta' }));
    await heading('Beta');
    expect(source?.closed).toBe(true);
    expect(open().map((s) => s.url).filter((url) => url.includes('projectId=p1'))).toEqual([]);
    expect(open().some((s) => s.url.includes('projectId=p2'))).toBe(true);

    unmount();
    expect(open().filter((s) => s.url.includes('projectId=p2'))).toEqual([]);
  });
});

describe('criterion 6: footer', () => {
  it('computes tokens / working minutes and never renders "Salud del clúster"', async () => {
    trees.p1 = [node('t1', 1, { metrics: metrics(30_000, 120_000) })];
    mount([project('p1', 'Alfa')]);
    expect(await screen.findByText(/Tokens por minuto: ~15 mil/)).toBeTruthy();
    expect(screen.queryByText(/Salud del cl/i)).toBeNull();
  });
});
