// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planUsageApi } from '../../api/planUsageApi';
import { NOW, planUsage } from './planUsageFixtures';
import { PlanUsageIndicator } from './PlanUsageIndicator';
import { UsageBar } from './UsageBar';

vi.mock('../../api/planUsageApi', () => ({ planUsageApi: { get: vi.fn() } }));
const get = vi.mocked(planUsageApi.get);

const BOUNDARIES = [
  [0, 'ok', 'stroke-success'],
  [69.9, 'ok', 'stroke-success'],
  [70, 'warning', 'stroke-warning'],
  [89.9, 'warning', 'stroke-warning'],
  [90, 'critical', 'stroke-danger'],
  [100, 'critical', 'stroke-danger'],
] as const;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('UsageBar level at thresholds (QA)', () => {
  it.each(BOUNDARIES)('%s %% is level %s', (utilization, level) => {
    render(<UsageBar label="Semanal (7 d)" window={{ utilization, resetsAt: null }} now={NOW} />);
    const meter = screen.getByRole('meter', { name: 'Semanal (7 d)' });
    expect(meter.getAttribute('data-level')).toBe(level);
    expect(meter.getAttribute('aria-valuenow')).toBe(String(Math.round(utilization)));
  });
});

describe('PlanUsageIndicator donut (QA)', () => {
  const mount = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PlanUsageIndicator />
      </QueryClientProvider>,
    );

  it.each(BOUNDARIES)('session %s %% paints the donut arc as %s', async (utilization, _level, stroke) => {
    get.mockResolvedValue(planUsage({ session: { utilization, resetsAt: null } }));
    mount();
    const button = await screen.findByRole('button', { name: /Uso de Claude: sesión/ });
    const arcs = button.querySelectorAll('circle');
    expect(arcs).toHaveLength(2);
    expect(arcs[1]?.getAttribute('class')).toContain(stroke);
    expect(button.getAttribute('aria-label')).toBe(`Uso de Claude: sesión ${Math.round(utilization)} %`);
  });

  it('popover shows reset labels for both windows and closes when focus leaves', async () => {
    get.mockResolvedValue(planUsage());
    mount();
    const button = await screen.findByRole('button', { name: /Uso de Claude/ });
    await userEvent.tab();
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('se reinicia en 2 h 15 min');
    expect(tooltip.textContent).toMatch(/se reinicia el \S+ 27, 18:00|se reinicia el \S+ 27, \d{2}:\d{2}/);
    await userEvent.tab();
    expect(document.activeElement).not.toBe(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
