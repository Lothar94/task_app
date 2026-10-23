// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planUsageApi } from '../../api/planUsageApi';
import { NOW, planUsage, unavailable } from './planUsageFixtures';
import { PlanUsageIndicator } from './PlanUsageIndicator';

vi.mock('../../api/planUsageApi', () => ({ planUsageApi: { get: vi.fn() } }));

const get = vi.mocked(planUsageApi.get);

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PlanUsageIndicator />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  get.mockResolvedValue(planUsage());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('PlanUsageIndicator', () => {
  it('shows a loading placeholder until the limits arrive', async () => {
    mount();
    expect(screen.getByRole('status', { name: 'Cargando uso de Claude' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Uso de Claude: sesión 86 %' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the session percentage in the donut', async () => {
    mount();
    const button = await screen.findByRole('button', { name: 'Uso de Claude: sesión 86 %' });
    expect(button.textContent).toBe('86');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('reveals both limits on hover and hides them on leave', async () => {
    mount();
    const button = await screen.findByRole('button', { name: /Uso de Claude/ });
    await userEvent.hover(button);
    const tooltip = screen.getByRole('tooltip');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(screen.getByRole('meter', { name: 'Sesión (5 h)' }).getAttribute('aria-valuenow')).toBe('86');
    expect(screen.getByRole('meter', { name: 'Semanal (7 d)' }).getAttribute('aria-valuenow')).toBe('42');
    expect(screen.getByText('Plan Max')).toBeTruthy();
    expect(screen.getByText('actualizado hace 3 minutos')).toBeTruthy();
    await userEvent.unhover(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('reveals the limits on keyboard focus and Esc closes them', async () => {
    mount();
    const button = await screen.findByRole('button', { name: /Uso de Claude/ });
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('meter', { name: 'Semanal (7 d)' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('shows a grey dash and the reason when unavailable', async () => {
    get.mockResolvedValue(unavailable('expired_credentials'));
    mount();
    const button = await screen.findByRole('button', { name: 'Uso de Claude: no disponible' });
    expect(button.textContent).toBe('—');
    await userEvent.hover(button);
    expect(screen.getByRole('tooltip').textContent).toContain(
      'Credenciales de Claude caducadas: abre Claude Code para renovarlas',
    );
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('is unavailable when the request fails', async () => {
    get.mockRejectedValue(new Error('network'));
    mount();
    const button = await screen.findByRole('button', { name: 'Uso de Claude: no disponible' });
    await userEvent.hover(button);
    expect(screen.getByRole('tooltip').textContent).toContain('No se pudo consultar el uso de Claude');
  });

  it('shows a dash but still lists the weekly bar when the plan has no session window', async () => {
    get.mockResolvedValue(planUsage({ session: null }));
    mount();
    const button = await screen.findByRole('button', { name: 'Uso de Claude: no disponible' });
    await userEvent.hover(button);
    expect(screen.queryByRole('meter', { name: 'Sesión (5 h)' })).toBeNull();
    expect(screen.getByRole('meter', { name: 'Semanal (7 d)' })).toBeTruthy();
  });
});
