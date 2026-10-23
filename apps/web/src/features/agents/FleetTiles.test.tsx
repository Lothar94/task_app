// @vitest-environment jsdom
import type { BudgetDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '../../api/dashboardApi';
import { dashboard, totals } from '../dashboard/dashboardFixtures';
import { agentFixture } from './agentTestData';
import { FleetTiles } from './FleetTiles';

vi.mock('../organizations/OrganizationContext', () => ({ useCurrentOrganization: () => ({ id: 'org' }) }));
vi.mock('../../api/dashboardApi', () => ({ dashboardApi: { get: vi.fn(), budget: vi.fn() } }));

const budget = (patch: Partial<BudgetDto> = {}): BudgetDto => ({
  month: '2026-10',
  monthToDateCostUsd: 14.28,
  monthlyLimitUsd: 150,
  ...patch,
});
const agents = [
  agentFixture({ mcpServers: ['postgres', 'git'] }),
  agentFixture({ id: 'a2', mcpServers: ['docker', 'git'] }),
];

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FleetTiles agents={agents} />
    </QueryClientProvider>,
  );
const tile = (label: RegExp) => screen.getByText(label).parentElement!.parentElement!;

beforeEach(() => {
  vi.mocked(dashboardApi.get).mockImplementation(async (_org, { days }) =>
    dashboard({
      totals: totals(days === 1 ? { totalTokens: 1_482_910 } : { completed: 248, successRate: 0.991 }),
    }),
  );
  vi.mocked(dashboardApi.budget).mockResolvedValue(budget());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FleetTiles', () => {
  it('shows 24h tokens, month-to-date cost with its limit, executed tasks and MCP servers', async () => {
    mount();
    await screen.findByText(/Límite mensual/);
    await screen.findByText('248');
    expect(dashboardApi.get).toHaveBeenCalledWith('org', { projectId: null, days: 1 });
    expect(within(tile(/Total tokens \(24h\)/)).getByText(/1,5\s?M/)).toBeTruthy();
    const cost = tile(/Coste acumulado/);
    expect(cost.textContent).toMatch(/14,28/);
    expect(cost.textContent).toMatch(/Límite mensual: 150,00\s?US\$/);
    expect(tile(/Tareas ejecutadas/).textContent).toMatch(/99\s%\séxito global/);
    const mcp = tile(/Herramientas MCP/);
    expect(mcp.textContent).toContain('3');
    expect(mcp.textContent).toContain('docker + git + postgres');
  });

  it('warns near the monthly limit and hides the limit line without one', async () => {
    vi.mocked(dashboardApi.budget).mockResolvedValueOnce(budget({ monthToDateCostUsd: 140 }));
    mount();
    expect((await screen.findByText(/93\s%\susado/)).textContent).toContain('Límite mensual');
    cleanup();
    vi.mocked(dashboardApi.budget).mockResolvedValueOnce(budget({ monthlyLimitUsd: null }));
    mount();
    await screen.findByText('este mes');
    expect(screen.queryByText(/Límite mensual/)).toBeNull();
  });

  it('keeps budget and MCP tiles when the fleet has not run yet', async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue(
      dashboard({ totals: totals({ runs: 0, completed: 0, successRate: null, totalTokens: 0 }) }),
    );
    mount();
    await screen.findByText(/Límite mensual/);
    expect(screen.getByText(/Herramientas MCP/)).toBeTruthy();
    expect(screen.getByText(/Total tokens \(24h\)/)).toBeTruthy();
  });
});
