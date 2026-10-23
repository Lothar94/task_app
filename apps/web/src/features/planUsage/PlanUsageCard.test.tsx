// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planUsageApi } from '../../api/planUsageApi';
import { NOW, planUsage, unavailable } from './planUsageFixtures';
import { PlanUsageCard } from './PlanUsageCard';

vi.mock('../../api/planUsageApi', () => ({ planUsageApi: { get: vi.fn() } }));

const get = vi.mocked(planUsageApi.get);

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PlanUsageCard />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('PlanUsageCard', () => {
  it('lists both limits and the subscription type', async () => {
    get.mockResolvedValue(planUsage());
    mount();
    expect(screen.getByRole('heading', { name: 'Límites de uso de Claude' })).toBeTruthy();
    expect((await screen.findByRole('meter', { name: 'Sesión (5 h)' })).getAttribute('aria-valuenow')).toBe('86');
    expect(screen.getByRole('meter', { name: 'Semanal (7 d)' }).getAttribute('aria-valuenow')).toBe('42');
    expect(screen.getByText('Plan Max')).toBeTruthy();
    expect(screen.getByText('se reinicia en 2 h 15 min')).toBeTruthy();
  });

  it('says why the limits are unavailable', async () => {
    get.mockResolvedValue(unavailable('no_credentials'));
    mount();
    expect(await screen.findByText('Sin sesión de Claude en esta máquina')).toBeTruthy();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('says the plan reports no limits when both windows are missing', async () => {
    get.mockResolvedValue(planUsage({ session: null, weekly: null }));
    mount();
    expect(await screen.findByText('Tu plan no informa de límites de uso')).toBeTruthy();
  });
});
