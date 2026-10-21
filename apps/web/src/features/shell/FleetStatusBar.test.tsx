// @vitest-environment jsdom
import type { FleetStatusDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FleetStatusBar, formatNodes } from './FleetStatusBar';

vi.mock('../organizations/OrganizationContext', () => ({
  useCurrentOrganization: () => ({ id: 'org', name: 'Acme' }),
}));

const status = (patch: Partial<FleetStatusDto> = {}): FleetStatusDto => ({
  state: 'active',
  activeNodes: [
    { agentId: 'a1', name: 'Lara', activeTasks: 2 },
    { agentId: 'a2', name: 'Vega', activeTasks: 1 },
  ],
  totalAgents: 4,
  activeTasks: 3,
  version: '0.1.0',
  generatedAt: '2026-10-21T09:00:00.000Z',
  ...patch,
});

let fetchMock: ReturnType<typeof vi.fn>;

/** The fake clock only moves while a request is in flight: every round trip takes 142 ms. */
function mount(response: () => Response) {
  let clock = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  fetchMock = vi.fn(async () => {
    clock += 142;
    return response();
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FleetStatusBar />
    </QueryClientProvider>,
  );
  return screen.getByRole('contentinfo');
}

const ok = (body: FleetStatusDto) => () => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('formatNodes', () => {
  it('joins busy agents with their load', () => {
    expect(formatNodes(status().activeNodes)).toBe('Lara (2) · Vega (1)');
  });
});

describe('FleetStatusBar', () => {
  it('shows an active fleet with nodes, measured latency and version', async () => {
    const footer = mount(ok(status()));
    expect(screen.getByRole('status').textContent).toBe('Flota: conectando…');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Flota: Activa'));
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org/fleet-status', expect.anything());
    expect(footer.textContent).toContain('Nodos activos: Lara (2) · Vega (1)');
    expect(footer.textContent).toContain('Latencia: 142 ms');
    expect(footer.textContent).toContain('v0.1.0');
    expect(footer.querySelector('[aria-live]')).toBeNull();
  });

  it('shows an idle fleet without nodes', async () => {
    const footer = mount(ok(status({ state: 'idle', activeNodes: [], activeTasks: 0 })));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Flota: En reposo'));
    expect(footer.textContent).toContain('Nodos activos: ninguno');
  });

  it('reports a lost API without latency', async () => {
    const footer = mount(() => new Response('{}', { status: 503 }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API sin conexión'));
    expect(footer.textContent).not.toContain('Latencia');
  });
});
