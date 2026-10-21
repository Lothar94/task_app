// @vitest-environment jsdom
import type { FleetEvent } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenter } from './NotificationCenter';
import { created, updated } from './notificationTestData';

const current = vi.hoisted(() => ({ id: 'org-a', name: 'A' }));
vi.mock('../organizations/OrganizationContext', () => ({
  useCurrentOrganization: () => current,
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

const open = () => FakeEventSource.instances.filter((source) => !source.closed);
const emit = (event: FleetEvent) =>
  act(() => {
    for (const source of open()) source.onmessage?.({ data: JSON.stringify(event) } as MessageEvent);
  });

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function tree() {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationCenter />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

let client: QueryClient;
const bell = () => screen.getByRole('button', { name: /^Notificaciones/ });

beforeEach(() => {
  current.id = 'org-a';
  FakeEventSource.instances = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([{ id: 'p1', name: 'Vega' }]), { status: 200 })),
  );
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('NotificationCenter QA', () => {
  it('opens exactly one EventSource for the organization', () => {
    render(tree());
    expect(FakeEventSource.instances.map((source) => source.url)).toEqual(['/api/events?organizationId=org-a']);
  });

  it('keeps a separate list per organization and reconnects when switching', () => {
    const view = render(tree());
    emit(updated({ id: 'a1', status: 'failed' }));
    emit(updated({ id: 'a2', status: 'failed' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 2 sin leer');

    current.id = 'org-b';
    view.rerender(tree());
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    expect(open().map((source) => source.url)).toEqual(['/api/events?organizationId=org-b']);
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
    emit(updated({ id: 'b1', status: 'completed' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 1 sin leer');

    current.id = 'org-a';
    view.rerender(tree());
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 2 sin leer');
    expect(JSON.parse(localStorage.getItem('fleet.notifications.org-b') ?? '[]')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('fleet.notifications.org-a') ?? '[]')).toHaveLength(2);
  });

  it('does not leak the notifications of the previous organization into the next one on storage', () => {
    const view = render(tree());
    emit(updated({ id: 'a1', status: 'failed' }));
    current.id = 'org-b';
    view.rerender(tree());
    const stored = JSON.parse(localStorage.getItem('fleet.notifications.org-b') ?? '[]') as { taskId: string }[];
    expect(stored.map((item) => item.taskId)).not.toContain('a1');
  });

  it('starts empty and does not crash with corrupt localStorage', () => {
    localStorage.setItem('fleet.notifications.org-a', '{{{');
    render(tree());
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
    emit(updated({ status: 'failed' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 1 sin leer');
  });

  it('restores read state after a reload', async () => {
    render(tree());
    emit(updated({ status: 'failed' }));
    await userEvent.click(bell());
    await userEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    cleanup();
    render(tree());
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
  });

  it('caps the badge at 9+ while the label keeps the exact count', () => {
    render(tree());
    for (let i = 0; i < 12; i++) emit(updated({ id: `t${i}`, status: 'failed' }));
    expect(bell().textContent).toBe('9+');
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 12 sin leer');
  });

  it('ignores subtask completions, duplicates and proposal start in the bell', () => {
    render(tree());
    emit(updated({ id: 'sub', status: 'completed', parentTaskId: 'root' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
    emit(created({ id: 'p', status: 'draft', proposedByAgentId: 'a2' }));
    emit(created({ id: 'p', status: 'draft', proposedByAgentId: 'a2' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 1 sin leer');
    emit(updated({ id: 'p', status: 'running', proposedByAgentId: 'a2' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
  });

  it('removes a proposal from the open panel when it is approved elsewhere', async () => {
    render(tree());
    emit(created({ id: 'p', status: 'draft', proposedByAgentId: 'a2' }));
    await userEvent.click(bell());
    const panel = screen.getByRole('dialog', { name: 'Notificaciones' });
    expect(within(panel).getByText('Propuesta pendiente de aprobación')).toBeTruthy();
    emit(updated({ id: 'p', status: 'queued', proposedByAgentId: 'a2' }));
    expect(within(panel).queryByText('Propuesta pendiente de aprobación')).toBeNull();
    expect(within(panel).getByText('Sin notificaciones.')).toBeTruthy();
  });

  it('wires aria-expanded/aria-controls of the bell to the panel and toggles on click', async () => {
    render(tree());
    expect(bell().getAttribute('aria-expanded')).toBe('false');
    expect(bell().hasAttribute('aria-controls')).toBe(false);
    await userEvent.click(bell());
    const panel = screen.getByRole('dialog');
    expect(bell().getAttribute('aria-controls')).toBe(panel.id);
    await userEvent.click(bell());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('marks a single notification read when opened, leaving the others unread', async () => {
    render(tree());
    emit(updated({ id: 'a', number: 1, title: 'Alfa', status: 'failed' }));
    emit(updated({ id: 'b', number: 2, title: 'Beta', status: 'failed' }));
    await userEvent.click(bell());
    await userEvent.click(screen.getByRole('button', { name: /Tarea 1 · Alfa/ }));
    expect(screen.getByTestId('where').textContent).toBe('/projects/p1/tasks/a');
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 1 sin leer');
  });

  it('lists newest first', async () => {
    render(tree());
    emit(updated({ id: 'a', number: 1, title: 'Alfa', status: 'failed' }));
    emit(updated({ id: 'b', number: 2, title: 'Beta', status: 'completed' }));
    await userEvent.click(bell());
    const titles = within(screen.getByRole('dialog')).getAllByRole('listitem').map((item) => item.textContent);
    expect(titles[0]).toContain('Beta');
    expect(titles[1]).toContain('Alfa');
  });

  it('closes the connection on unmount', () => {
    render(tree());
    cleanup();
    expect(open()).toHaveLength(0);
  });
});
