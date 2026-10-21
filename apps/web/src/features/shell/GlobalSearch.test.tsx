// @vitest-environment jsdom
import type { SearchResultsDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalSearch } from './GlobalSearch';

vi.mock('../organizations/OrganizationContext', () => ({
  useCurrentOrganization: () => ({ id: 'org', name: 'Acme' }),
}));

const RESULTS: SearchResultsDto = {
  query: 've',
  projects: [{ id: 'p1', name: 'Vega', archived: false }],
  tasks: [{ id: 't9', number: 61, title: 'Revisar login', status: 'running', projectId: 'p1', projectName: 'Vega' }],
  agents: [{ id: 'a1', name: 'Vera', role: 'QA' }],
};

let fetchMock: ReturnType<typeof vi.fn>;

function stubSearch(results: SearchResultsDto) {
  fetchMock = vi.fn(async () => new Response(JSON.stringify(results), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
}

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <button type="button">fuera</button>
        <GlobalSearch />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.getByRole('combobox', { name: 'Buscar proyectos, tareas y agentes' });
}

const activeOptionName = (input: HTMLElement) => {
  const id = input.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id)?.textContent : null;
};

beforeEach(() => stubSearch(RESULTS));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GlobalSearch', () => {
  it('exposes the WAI-ARIA combobox attributes, closed while empty', () => {
    const input = mount();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    const listbox = document.getElementById(input.getAttribute('aria-controls')!);
    expect(listbox?.getAttribute('role')).toBe('listbox');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('queries the organization once typing settles and lists labelled groups', async () => {
    const input = mount();
    await userEvent.type(input, '  ve ');
    const listbox = await screen.findByRole('listbox', { name: 'Resultados de búsqueda' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org/search?q=ve', expect.anything());
    const groups = within(listbox).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-labelledby') && group.textContent?.slice(0, 9))).toEqual([
      'Proyectos',
      'TareasTar',
      'AgentesVe',
    ]);
    expect(within(groups[1]!).getByRole('option').textContent).toContain('Tarea 61 · Revisar login · Vega');
    expect(screen.getByRole('status').textContent).toBe('3 resultados');
  });

  it('moves the active option with wrapping arrows and Home/End', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    await screen.findByRole('listbox');
    expect(activeOptionName(input)).toBe('Vega');
    await userEvent.keyboard('{ArrowUp}');
    expect(activeOptionName(input)).toBe('VeraQA');
    await userEvent.keyboard('{ArrowDown}');
    expect(activeOptionName(input)).toBe('Vega');
    await userEvent.keyboard('{End}');
    expect(activeOptionName(input)).toBe('VeraQA');
    await userEvent.keyboard('{Home}{ArrowDown}');
    expect(activeOptionName(input)).toContain('Tarea 61');
    const selected = screen.getAllByRole('option').filter((option) => option.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
  });

  it('navigates to the active option on Enter, then closes and clears', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('where').textContent).toBe('/projects/p1/tasks/t9');
    expect((input as HTMLInputElement).value).toBe('');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('navigates on click too', async () => {
    mount();
    await userEvent.type(screen.getByRole('combobox'), 've');
    await userEvent.click(await screen.findByRole('option', { name: /Vera/ }));
    expect(screen.getByTestId('where').textContent).toBe('/agents/a1');
  });

  it('closes on Escape and clears and leaves on a second Escape', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect((input as HTMLInputElement).value).toBe('ve');
    await userEvent.keyboard('{Escape}');
    expect((input as HTMLInputElement).value).toBe('');
    expect(document.activeElement).not.toBe(input);
  });

  it('shows and announces the empty state', async () => {
    stubSearch({ query: 'zz', projects: [], tasks: [], agents: [] });
    const input = mount();
    await userEvent.type(input, 'zz');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sin resultados'));
    expect(screen.getByText('Sin resultados', { selector: 'p:not([role])' })).toBeTruthy();
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('focuses the search with ⌘K and Ctrl+K from anywhere', async () => {
    const input = mount();
    screen.getByRole('button', { name: 'fuera' }).focus();
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);

    screen.getByRole('button', { name: 'fuera' }).focus();
    fireEvent.keyDown(document.body, { key: 'K', ctrlKey: true });
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('button', { name: 'Buscar' }).getAttribute('aria-expanded')).toBe('true');
  });
});
