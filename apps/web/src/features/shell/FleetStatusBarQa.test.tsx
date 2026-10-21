// @vitest-environment jsdom
import type { FleetStatusDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FleetStatusBar } from './FleetStatusBar';
import { queryKeys } from '../../api/queryKeys';

vi.mock('../organizations/OrganizationContext', () => ({
  useCurrentOrganization: () => ({ id: 'org', name: 'Acme' }),
}));

const status = (patch: Partial<FleetStatusDto> = {}): FleetStatusDto => ({
  state: 'active',
  activeNodes: [{ agentId: 'a1', name: 'Lara', activeTasks: 2 }],
  totalAgents: 4,
  activeTasks: 2,
  version: '0.1.0',
  generatedAt: '2026-10-21T09:00:00.000Z',
  ...patch,
});

let client: QueryClient;
let responses: (() => Response)[];

function mount(...queue: (() => Response)[]) {
  responses = queue;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => (responses.length > 1 ? responses.shift()! : responses[0]!)()),
  );
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FleetStatusBar />
    </QueryClientProvider>,
  );
  return screen.getByRole('contentinfo');
}

const ok = (body: FleetStatusDto) => () => new Response(JSON.stringify(body), { status: 200 });
const down = () => new Response('{}', { status: 503 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FleetStatusBar QA', () => {
  it('shows the error state with no nodes, latency or version when the API is down from the start', async () => {
    const footer = mount(down);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API sin conexión'));
    expect(footer.textContent).not.toMatch(/Nodos|Latencia|v\d/);
  });

  it('treats a network failure like an error response', async () => {
    const footer = mount(() => {
      throw new TypeError('Failed to fetch');
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API sin conexión'));
    expect(footer.textContent).not.toContain('Latencia');
  });

  it('treats a 404 (organization gone) as an error', async () => {
    mount(() => new Response(JSON.stringify({ error: 'not found' }), { status: 404 }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API sin conexión'));
  });

  it('switches to the error state after a failed refresh and recovers when the API returns', async () => {
    const footer = mount(
      ok(status()),
      down,
      ok(status({ state: 'idle', activeNodes: [], version: '0.2.0' })),
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Flota: Activa'));

    await client.refetchQueries({ queryKey: queryKeys.fleetStatus('org') });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('API sin conexión'));
    expect(footer.textContent).not.toContain('Nodos activos');
    expect(footer.textContent).not.toContain('Latencia');

    await client.refetchQueries({ queryKey: queryKeys.fleetStatus('org') });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Flota: En reposo'));
    expect(footer.textContent).toContain('v0.2.0');
    expect(footer.textContent).toContain('Nodos activos: ninguno');
  });

  it('is a single contentinfo landmark fixed at the bottom', async () => {
    const footer = mount(ok(status()));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Flota: Activa'));
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(footer.className).toContain('fixed');
    expect(footer.className).toContain('bottom-0');
  });

  it('lists every active node with its load in server order', async () => {
    const footer = mount(
      ok(
        status({
          activeNodes: [
            { agentId: 'a', name: 'Zed', activeTasks: 3 },
            { agentId: 'b', name: 'Amy', activeTasks: 1 },
          ],
        }),
      ),
    );
    await waitFor(() => expect(footer.textContent).toContain('Nodos activos: Zed (3) · Amy (1)'));
  });
});
