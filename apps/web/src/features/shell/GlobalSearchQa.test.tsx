// @vitest-environment jsdom
import { SEARCH_LIMITS, type SearchResultsDto } from '@fleet/shared';
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
  projects: [
    { id: 'p1', name: 'Vega', archived: false },
    { id: 'p2', name: 'Vieja', archived: true },
  ],
  tasks: [{ id: 't9', number: 61, title: 'Revisar login', status: 'running', projectId: 'p1', projectName: 'Vega' }],
  agents: [{ id: 'a1', name: 'Vera', role: 'QA' }],
};

let fetchMock: ReturnType<typeof vi.fn>;

function stubSearch(results: SearchResultsDto | (() => Response)) {
  fetchMock = vi.fn(async () =>
    typeof results === 'function' ? results() : new Response(JSON.stringify(results), { status: 200 }),
  );
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
  return screen.getByRole('combobox', { name: 'Buscar proyectos, tareas y agentes' }) as HTMLInputElement;
}

const activeText = (input: HTMLElement) => {
  const id = input.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id)?.textContent : null;
};

beforeEach(() => stubSearch(RESULTS));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'platform');
});

describe('GlobalSearch QA', () => {
  it('makes no request for an empty or whitespace-only query, nor after clearing it', async () => {
    const input = mount();
    await userEvent.click(input);
    await userEvent.type(input, '   ');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('coalesces fast typing into a single request with the final text', async () => {
    const input = mount();
    await userEvent.type(input, 'vega');
    await screen.findByRole('listbox');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations/org/search?q=vega', expect.anything());
  });

  it('url-encodes special characters of the query', async () => {
    const input = mount();
    await userEvent.type(input, 'a&b #1');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/organizations/org/search?q=a%26b+%231');
  });

  it('limits the input to the maximum query length of the contract', () => {
    expect(mount().maxLength).toBe(SEARCH_LIMITS.queryLength);
  });

  it('has the combobox/listbox/group/option structure of WAI-ARIA 1.2', async () => {
    const input = mount();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-haspopup') ?? 'listbox').toBe('listbox');
    await userEvent.type(input, 've');
    const listbox = await screen.findByRole('listbox');
    expect(listbox.id).toBe(input.getAttribute('aria-controls'));
    expect(listbox.hidden).toBe(false);
    const groups = within(listbox).getAllByRole('group');
    for (const group of groups) {
      const label = document.getElementById(group.getAttribute('aria-labelledby')!);
      expect(label?.textContent).toMatch(/^(Proyectos|Tareas|Agentes)$/);
    }
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(new Set(options.map((option) => option.id)).size).toBe(4);
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id);
    // focus stays in the input: options are never tabbable
    expect(options.every((option) => option.getAttribute('tabindex') === null)).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it('flags archived projects in the results', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    const option = await screen.findByRole('option', { name: /Vieja/ });
    expect(option.textContent).toContain('Archivado');
  });

  it('hides the listbox again (aria-expanded=false, no activedescendant) when there are no results', async () => {
    stubSearch({ query: 'zz', projects: [], tasks: [], agents: [] });
    const input = mount();
    await userEvent.type(input, 'zz');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sin resultados'));
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where').textContent).toBe('/dashboard');
  });

  it('does not navigate on Enter while the list is closed (after Escape)', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}{Enter}');
    expect(screen.getByTestId('where').textContent).toBe('/dashboard');
    expect(input.value).toBe('ve');
  });

  it('reopens the closed list with ArrowDown without moving the selection', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    await userEvent.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(activeText(input)).toBe('Vega');
  });

  it('resets the active option to the first one when the query changes', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    await screen.findByRole('listbox');
    await userEvent.keyboard('{End}');
    expect(activeText(input)).toBe('VeraQA');
    await userEvent.type(input, 'r');
    await waitFor(() => expect(activeText(input)).toBe('Vega'));
  });

  it('keeps Home/End moving the caret while there is no list', async () => {
    const input = mount();
    await userEvent.type(input, 'abc');
    // Dispatched before the debounce settles: there is no list to move through yet.
    const home = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    input.dispatchEvent(home);
    expect(home.defaultPrevented).toBe(false);
  });

  it('highlights the hovered option and navigates to it on click', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    const task = await screen.findByRole('option', { name: /Tarea 61/ });
    fireEvent.mouseMove(task);
    expect(task.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(task.id);
    await userEvent.click(task);
    expect(screen.getByTestId('where').textContent).toBe('/projects/p1/tasks/t9');
  });

  it.each([
    ['Vega', '/projects/p1'],
    ['Vera', '/agents/a1'],
  ])('navigates to %s with Enter', async (name, path) => {
    const input = mount();
    await userEvent.type(input, 've');
    await screen.findByRole('listbox');
    if (name === 'Vera') await userEvent.keyboard('{End}');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where').textContent).toBe(path);
  });

  it('closes when focus leaves the search', async () => {
    const input = mount();
    await userEvent.type(input, 've');
    await screen.findByRole('listbox');
    await userEvent.click(screen.getByRole('button', { name: 'fuera' }));
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('reports a failed search without options', async () => {
    stubSearch(() => new Response('{}', { status: 500 }));
    const input = mount();
    await userEvent.type(input, 've');
    await waitFor(() => expect(screen.getAllByText('No se pudo completar la búsqueda.')).toHaveLength(2));
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  describe('shortcut', () => {
    const press = (init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true, ...init });
      document.body.dispatchEvent(event);
      return event;
    };

    it('shows ⌘K on a mac and Ctrl K otherwise', () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
      mount();
      expect(document.querySelector('kbd')?.textContent).toBe('⌘K');
      cleanup();
      Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
      mount();
      expect(document.querySelector('kbd')?.textContent).toBe('Ctrl K');
    });

    it('opens from the shortcut whatever the platform, and selects the existing text', async () => {
      const input = mount();
      await userEvent.type(input, 'abc');
      screen.getByRole('button', { name: 'fuera' }).focus();
      expect(press({ metaKey: true }).defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(3);
    });

    it('leaves other combinations alone', () => {
      mount();
      for (const init of [{}, { ctrlKey: true, shiftKey: true }, { ctrlKey: true, altKey: true }, { ctrlKey: true, key: 'j' }]) {
        expect(press(init).defaultPrevented).toBe(false);
      }
    });

    it('removes its listener on unmount', () => {
      mount();
      cleanup();
      expect(press({ ctrlKey: true }).defaultPrevented).toBe(false);
    });

    it('exposes the toggle button state for narrow screens', async () => {
      mount();
      const toggle = screen.getByRole('button', { name: 'Buscar' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      await userEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(screen.getByRole('combobox'));
      await userEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });
  });
});
