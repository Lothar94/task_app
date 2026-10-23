// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentsApi } from '../../api/agentsApi';
import { dashboardApi } from '../../api/dashboardApi';
import { dashboard } from '../dashboard/dashboardFixtures';
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

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  vi.mocked(agentsApi.list).mockResolvedValue(team);
  vi.mocked(agentsApi.activity).mockResolvedValue(
    activityFixture({ agents: [{ agentId: 'dev', state: 'working', activeTasks: 1, currentTask }] }),
  );
  vi.mocked(agentsApi.runtime).mockResolvedValue({
    supports: { temperature: false, maxOutputTokens: false },
    mcpServers: [],
  });
  vi.mocked(dashboardApi.get).mockResolvedValue(dashboard());
  vi.mocked(dashboardApi.budget).mockResolvedValue({
    month: '2026-10',
    monthToDateCostUsd: 1,
    monthlyLimitUsd: null,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgentsPage views', () => {
  it('shows the active agents of the live activity in the header', async () => {
    mount();
    expect(await screen.findByText('1 activo')).toBeTruthy();
  });

  it('offers Lista, Diagrama and Dual and remembers the choice', async () => {
    mount();
    await screen.findByText('Lara');
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Lista',
      'Diagrama',
      'Dual',
    ]);
    await userEvent.click(screen.getByRole('radio', { name: 'Dual' }));
    const dual = screen.getByTestId('dual-view');
    expect(within(dual).getByRole('list')).toBeTruthy();
    expect(within(dual).getByRole('img', { name: 'Diagrama de delegación entre agentes' })).toBeTruthy();
    expect(localStorage.getItem('fleet.agents.view')).toBe('dual');
  });

  it('keeps an older stored choice valid', async () => {
    localStorage.setItem('fleet.agents.view', 'list');
    mount();
    await screen.findByText('Lara');
    expect(screen.getByRole('radio', { name: 'Lista' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('img', { name: 'Diagrama de delegación entre agentes' })).toBeNull();
  });

  it('opens the sheet from a dual-view row and gives the focus back on Escape', async () => {
    localStorage.setItem('fleet.agents.view', 'dual');
    const user = userEvent.setup();
    mount();
    const list = within(await screen.findByTestId('dual-view')).getByRole('list');
    const row = within(list).getAllByRole('button')[1]!;
    await user.click(row);
    const sheet = screen.getByRole('complementary', { name: 'Ficha del agente' });
    await waitFor(() => expect(document.activeElement).toBe(sheet));
    expect(row.getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Ficha del agente' })).toBeNull();
    expect(document.activeElement).toBe(row);
  });
});
