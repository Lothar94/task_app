// @vitest-environment jsdom
import type { FleetEvent } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenter } from './NotificationCenter';
import { created, updated } from './notificationTestData';

vi.mock('../organizations/OrganizationContext', () => ({
  useCurrentOrganization: () => ({ id: 'org', name: 'Acme' }),
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {}
}

const emit = (event: FleetEvent) =>
  act(() => {
    for (const source of FakeEventSource.instances) source.onmessage?.({ data: JSON.stringify(event) } as MessageEvent);
  });

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function mount() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([{ id: 'p1', name: 'Vega' }]), { status: 200 })),
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <button type="button">fuera</button>
        <NotificationCenter />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const bell = () => screen.getByRole('button', { name: /^Notificaciones/ });

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('NotificationCenter', () => {
  it('counts unread notifications from the organization stream in the bell', () => {
    mount();
    expect(FakeEventSource.instances[0]?.url).toBe('/api/events?organizationId=org');
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
    emit(updated({ status: 'failed' }));
    emit(updated({ id: 't2', number: 8, status: 'completed' }));
    emit(updated({ id: 't2', number: 8, status: 'completed' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 2 sin leer');
    expect(bell().textContent).toBe('2');
  });

  it('lists notifications with project name and opens a task, marking it read', async () => {
    mount();
    emit(updated({ status: 'failed' }));
    await userEvent.click(bell());
    expect(bell().getAttribute('aria-expanded')).toBe('true');
    const panel = screen.getByRole('dialog', { name: 'Notificaciones' });
    expect(document.activeElement).toBe(panel);
    const item = within(panel).getByRole('button', { name: /Tarea 7 · Migrar login/ });
    expect(item.textContent).toContain('Tarea fallida');
    expect(item.textContent).toContain('No leída');
    expect(await within(panel).findByText(/Vega ·/)).toBeTruthy();

    await userEvent.click(item);
    expect(screen.getByTestId('where').textContent).toBe('/projects/p1/tasks/t1');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
  });

  it('marks all as read', async () => {
    mount();
    emit(updated({ status: 'failed' }));
    emit(created({ id: 't3', status: 'draft', proposedByAgentId: 'a2' }));
    await userEvent.click(bell());
    const markAll = screen.getByRole('button', { name: 'Marcar todas como leídas' });
    await userEvent.click(markAll);
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
    expect(screen.queryByText('No leída')).toBeNull();
    expect(markAll.hasAttribute('disabled')).toBe(true);
  });

  it('drops a proposal once approved', () => {
    mount();
    emit(created({ status: 'draft', proposedByAgentId: 'a2' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 1 sin leer');
    emit(updated({ status: 'queued', proposedByAgentId: 'a2' }));
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
  });

  it('closes on Escape returning focus to the bell, and on outside press', async () => {
    mount();
    await userEvent.click(bell());
    expect(screen.getByText('Sin notificaciones.')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(bell());
    await userEvent.click(bell());
    await userEvent.click(screen.getByRole('button', { name: 'fuera' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('remembers notifications of the organization across reloads', () => {
    mount();
    emit(updated({ status: 'failed' }));
    cleanup();
    mount();
    expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 1 sin leer');
  });
});
