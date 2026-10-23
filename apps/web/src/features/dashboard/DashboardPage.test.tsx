// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '../../api/dashboardApi';
import { planUsageApi } from '../../api/planUsageApi';
import { planUsage } from '../planUsage/planUsageFixtures';
import { dashboard, modelRow, totals } from './dashboardFixtures';
import { DashboardPage } from './DashboardPage';

vi.mock('../organizations/OrganizationContext', () => ({ useCurrentOrganization: () => ({ id: 'org' }) }));
vi.mock('../projects/projectQueries', () => ({ useProjects: () => ({ data: [] }) }));
vi.mock('../../api/dashboardApi', () => ({ dashboardApi: { get: vi.fn() } }));
vi.mock('../../api/planUsageApi', () => ({ planUsageApi: { get: vi.fn() } }));

const agentRow = (
  agentId: string,
  agentName: string,
  completed: number,
  failed: number,
  costUsd: number,
) => ({
  ...totals({ costUsd }),
  agentId,
  agentName,
  completed,
  failed,
  cancelled: 0,
});

const get = vi.mocked(dashboardApi.get);
const getPlanUsage = vi.mocked(planUsageApi.get);

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  get.mockResolvedValue(dashboard());
  getPlanUsage.mockResolvedValue(planUsage());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('shows the Claude limits above the dashboard, even while it fails', async () => {
    get.mockRejectedValue(new Error('boom'));
    mount();
    const card = (await screen.findByRole('heading', { name: 'Límites de uso de Claude' })).closest('section');
    expect(await within(card as HTMLElement).findByRole('meter', { name: 'Sesión (5 h)' })).toBeTruthy();
    expect(await screen.findByText(/boom/)).toBeTruthy();
  });

  it('offers 24 h before 7 days and queries one day when chosen', async () => {
    mount();
    const labels = screen.getAllByRole('radio').map((radio) => radio.textContent);
    expect(labels).toEqual(['24 h', '7 días', '30 días', '90 días', 'Todo']);
    await userEvent.click(screen.getByRole('radio', { name: '24 h' }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('org', { projectId: null, days: 1 }));
    expect(localStorage.getItem('fleet.dashboard.period')).toBe('24h');
  });

  it('restores a stored 24 h choice', async () => {
    localStorage.setItem('fleet.dashboard.period', '24h');
    mount();
    await waitFor(() => expect(get).toHaveBeenCalledWith('org', { projectId: null, days: 1 }));
    expect(screen.getByRole('radio', { name: '24 h' }).getAttribute('aria-checked')).toBe('true');
  });

  it('labels hourly activity as HH:00', async () => {
    get.mockResolvedValue(
      dashboard({
        activityGranularity: 'hour',
        filters: { projectId: null, days: 1 },
        daily: [{ date: '2026-10-21T08:00', totalTokens: 100, completed: 1, failed: 0 }],
      }),
    );
    mount();
    expect(await screen.findByText('08:00')).toBeTruthy();
    expect(screen.getByText('Tokens por hora')).toBeTruthy();
  });

  it('renders tiles with and without a previous period', async () => {
    get.mockResolvedValue(dashboard({ previous: totals({ costUsd: 5 }) }));
    mount();
    expect(await screen.findAllByText(/vs periodo ant\./)).not.toHaveLength(0);
    cleanup();
    get.mockResolvedValue(dashboard({ previous: null }));
    mount();
    await screen.findByText('Coste estimado');
    expect(screen.queryByText(/vs periodo ant\./)).toBeNull();
  });

  it('shows prices, per-kind costs and "sin tarifa" in the model breakdown', async () => {
    get.mockResolvedValue(
      dashboard({
        byModel: [
          modelRow(),
          modelRow({
            model: 'modelo-nuevo',
            pricing: null,
            cacheSavingsUsd: 0,
            cost: { inputUsd: 0, outputUsd: 0, cacheWriteUsd: 0, cacheReadUsd: 0 },
          }),
        ],
      }),
    );
    mount();
    await screen.findByText('Ver desglose tabular');
    expect(screen.getByText('3 / 15 / 3,75 / 0,3')).toBeTruthy();
    expect(screen.getByText('sin tarifa')).toBeTruthy();
    expect(screen.getByText(/Tasa de ahorro por prompt-cache/).textContent).toMatch(/75\s%/);
  });

  it('adds the fleet billed total under the agent table', async () => {
    get.mockResolvedValue(
      dashboard({
        byAgent: [agentRow('a1', 'Ana', 3, 1, 1.5), agentRow('a2', 'Beto', 1, 0, 2)],
      }),
    );
    mount();
    expect((await screen.findByText(/Total facturado flota/)).textContent).toContain('3,50');
    expect(within(screen.getByRole('row', { name: /Ana/ })).getByText('75 %')).toBeTruthy();
  });
});
