// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentsApi } from '../../api/agentsApi';
import { ApiError } from '../../api/httpClient';
import { dashboardApi } from '../../api/dashboardApi';
import { dashboard } from '../dashboard/dashboardFixtures';
import { AgentSheet } from './AgentSheet';
import { AgentsPage } from './AgentsPage';
import { activityFixture, agentFixture } from './agentTestData';

vi.mock('../organizations/OrganizationContext', () => ({ useCurrentOrganization: () => ({ id: 'org' }) }));
vi.mock('../../api/agentsApi', () => ({
  agentsApi: { list: vi.fn(), activity: vi.fn(), runtime: vi.fn(), update: vi.fn(), setEnabled: vi.fn() },
}));
vi.mock('../../api/dashboardApi', () => ({ dashboardApi: { get: vi.fn(), budget: vi.fn() } }));

const team = [
  agentFixture({ id: 'lead', name: 'Conde', role: 'CTO', collaboratorIds: ['dev'] }),
  agentFixture({ id: 'dev', name: 'Lara', role: 'Backend' }),
];
const currentTask = { taskId: 't', projectId: 'p', number: 1, title: 'Login' };
const unsupported = { supports: { temperature: false, maxOutputTokens: false }, mcpServers: [] };

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const mountPage = () =>
  render(
    <QueryClientProvider client={client()}>
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  vi.mocked(agentsApi.list).mockResolvedValue(team);
  vi.mocked(agentsApi.activity).mockResolvedValue(
    activityFixture({
      agents: [
        { agentId: 'dev', state: 'working', activeTasks: 1, currentTask },
        { agentId: 'lead', state: 'delegating', activeTasks: 1, currentTask: { ...currentTask, taskId: 'r' } },
      ],
      delegations: [{ fromAgentId: 'lead', toAgentId: 'dev', taskId: 't' }],
    }),
  );
  vi.mocked(agentsApi.runtime).mockResolvedValue(unsupported);
  vi.mocked(agentsApi.update).mockImplementation(async (id, input) => agentFixture({ ...input, id }));
  vi.mocked(dashboardApi.get).mockResolvedValue(dashboard());
  vi.mocked(dashboardApi.budget).mockResolvedValue({ month: '2026-10', monthToDateCostUsd: 3, monthlyLimitUsd: 10 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

/** Class tokens (also of SVG elements) that animate without the `motion-safe:` guard. */
function unguardedAnimations(): string[] {
  const offenders: string[] = [];
  for (const element of document.querySelectorAll('*')) {
    for (const token of (element.getAttribute('class') ?? '').split(/\s+/)) {
      if (/(^|:)animate-(?!none)/.test(token) && !token.startsWith('motion-safe:')) offenders.push(token);
    }
  }
  return offenders;
}

describe('QA: AgentsPage live state and reduced motion', () => {
  it.each(['list', 'diagram', 'dual'])(
    'never animates outside motion-safe in the %s view while agents are busy',
    async (view) => {
      localStorage.setItem('fleet.agents.view', view);
      mountPage();
      await screen.findByText('2 activos');
      await waitFor(() => expect(screen.getAllByText('Lara').length).toBeGreaterThan(0));
      expect(unguardedAnimations()).toEqual([]);
    },
  );

  it('shows the EN CURSO chip for the working agent in the diagram', async () => {
    localStorage.setItem('fleet.agents.view', 'diagram');
    mountPage();
    await screen.findByText('2 activos');
    const chips = [...document.querySelectorAll('[data-live-chip] text')].map((text) => text.textContent);
    expect(chips.length).toBe(2);
    expect(chips.every((chip) => chip?.startsWith('EN CURSO: '))).toBe(true);
  });

  it('zooms the diagram in, out and back to fit from the page', async () => {
    localStorage.setItem('fleet.agents.view', 'diagram');
    const user = userEvent.setup();
    mountPage();
    await screen.findByText('2 activos');
    const group = screen.getByRole('group', { name: 'Zoom del diagrama' });
    const percent = () => within(group).getByLabelText('Zoom actual').textContent;
    const initial = percent();
    await user.click(within(group).getByRole('button', { name: 'Acercar' }));
    expect(parseInt(percent()!)).toBeGreaterThan(parseInt(initial!));
    await user.click(within(group).getByRole('button', { name: 'Alejar' }));
    await user.click(within(group).getByRole('button', { name: 'Alejar' }));
    expect(parseInt(percent()!)).toBeLessThan(parseInt(initial!));
    await user.click(within(group).getByRole('button', { name: 'Encajar al ancho' }));
    expect(percent()).toBe(initial);
  });

  it('shows the over-limit state when the month cost passes the limit', async () => {
    vi.mocked(dashboardApi.budget).mockResolvedValue({ month: '2026-10', monthToDateCostUsd: 12, monthlyLimitUsd: 10 });
    mountPage();
    await screen.findByText('2 activos');
    expect((await screen.findByText(/Límite mensual.*superado/)).textContent).toMatch(/10,00/);
  });
});

describe('QA: AgentSheet', () => {
  const mountSheet = (agent = agentFixture({ temperature: 0.7, maxOutputTokens: 4096 })) =>
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter>
          <AgentSheet agent={agent} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('saves null for settings the runtime does not support even if the agent had stored values', async () => {
    const user = userEvent.setup();
    mountSheet();
    await screen.findAllByText(/no admite este ajuste/);
    await user.selectOptions(screen.getByLabelText('Modelo'), 'opus');
    await user.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    await waitFor(() => expect(agentsApi.update).toHaveBeenCalledTimes(1));
    expect(vi.mocked(agentsApi.update).mock.calls[0]![1]).toMatchObject({
      model: 'opus',
      temperature: null,
      maxOutputTokens: null,
    });
  });

  it('does not report success when disabling fails and keeps the agent as active', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(agentsApi.setEnabled).mockRejectedValue(new ApiError('boom', 500));
    const user = userEvent.setup();
    mountSheet(agentFixture());
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(agentsApi.setEnabled).toHaveBeenCalled());
    expect(await screen.findByText(/boom/)).toBeTruthy();
    expect(screen.queryByText('Agente desactivado.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeTruthy();
  });
});
