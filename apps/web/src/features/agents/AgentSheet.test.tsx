// @vitest-environment jsdom
import type { AgentRuntimeInfoDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentsApi } from '../../api/agentsApi';
import { ApiError } from '../../api/httpClient';
import { AgentSheet } from './AgentSheet';
import { agentFixture } from './agentTestData';

vi.mock('../organizations/OrganizationContext', () => ({ useCurrentOrganization: () => ({ id: 'org' }) }));
vi.mock('../../api/agentsApi', () => ({
  agentsApi: { runtime: vi.fn(), update: vi.fn(), setEnabled: vi.fn() },
}));

const runtime = (supported: boolean): AgentRuntimeInfoDto => ({
  supports: { temperature: supported, maxOutputTokens: supported },
  mcpServers: [
    { name: 'github', transport: 'stdio' },
    { name: 'postgres', transport: 'http' },
  ],
});
const agent = agentFixture({ mcpServers: ['github', 'legacy'] });

let queryClient: QueryClient;
const wrap = (children: ReactNode) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);
const mount = (props: Partial<Parameters<typeof AgentSheet>[0]> = {}) =>
  render(wrap(<AgentSheet key={props.agent?.id ?? agent.id} agent={agent} onClose={vi.fn()} {...props} />));
const saveButton = () =>
  screen.getByRole('button', { name: /Guardar cambios|Guardando/ }) as HTMLButtonElement;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(agentsApi.runtime).mockResolvedValue(runtime(true));
  vi.mocked(agentsApi.update).mockImplementation(async (id, input) => agentFixture({ ...input, id }));
  vi.mocked(agentsApi.setEnabled).mockImplementation(async (id, { enabled }) =>
    agentFixture({ id, enabled }),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('AgentSheet runtime settings', () => {
  it('disables temperature and max tokens with a hint when the runtime does not support them', async () => {
    vi.mocked(agentsApi.runtime).mockResolvedValue(runtime(false));
    mount();
    await screen.findAllByText(/no admite este ajuste/);
    expect((screen.getByRole('slider', { name: 'Temperatura' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Máx. tokens de salida/) as HTMLInputElement).disabled).toBe(true);
  });

  it('enables them when supported', async () => {
    mount();
    const tokens = screen.getByLabelText(/Máx. tokens de salida/) as HTMLInputElement;
    await waitFor(() => expect(tokens.disabled).toBe(false));
    const useDefault = screen.getByRole('checkbox', { name: 'Valor por defecto del runtime' });
    await userEvent.click(useDefault);
    expect((screen.getByRole('slider', { name: 'Temperatura' }) as HTMLInputElement).disabled).toBe(false);
  });

  it('lists catalog MCP servers and keeps missing ones checked as unavailable', async () => {
    mount();
    const mcp = screen.getByRole('group', { name: 'Servidores MCP' });
    await within(mcp).findByText('postgres');
    const legacy = within(mcp).getByRole('checkbox', { name: /legacy/ }) as HTMLInputElement;
    expect(legacy.checked).toBe(true);
    expect(within(mcp).getByText('no disponible')).toBeTruthy();
    expect((within(mcp).getByRole('checkbox', { name: /postgres/ }) as HTMLInputElement).checked).toBe(false);
  });
});

describe('AgentSheet save', () => {
  it('enables saving only after a change and sends the full AgentInput', async () => {
    const user = userEvent.setup();
    mount();
    await waitFor(() =>
      expect((screen.getByLabelText(/Máx. tokens de salida/) as HTMLInputElement).disabled).toBe(false),
    );
    expect(saveButton().disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText('Modelo'), 'opus');
    await user.click(screen.getByRole('checkbox', { name: 'Bash' }));
    await user.click(screen.getByRole('checkbox', { name: /postgres/ }));
    await user.type(screen.getByLabelText(/Máx. tokens de salida/), '8192');
    fireEvent.change(screen.getByRole('slider', { name: 'Temperatura' }), { target: { value: '0.3' } });
    await user.click(screen.getByRole('checkbox', { name: 'Valor por defecto del runtime' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Temperatura' }), { target: { value: '0.3' } });
    await user.click(saveButton());
    await waitFor(() => expect(agentsApi.update).toHaveBeenCalledTimes(1));
    expect(agentsApi.update).toHaveBeenCalledWith('a1', {
      name: 'Ada',
      role: 'Backend',
      description: '',
      instructions: 'Escribe código.',
      model: 'opus',
      effort: 'high',
      modelSelection: 'fixed',
      allowedTools: ['Read', 'Write', 'Bash'],
      skills: [],
      permissionMode: 'dontAsk',
      maxTurns: 50,
      temperature: 0.3,
      maxOutputTokens: 8192,
      mcpServers: ['github', 'postgres', 'legacy'],
    });
    expect((await screen.findByRole('status')).textContent).toBe('Cambios guardados.');
  });

  it('shows server validation errors next to the field and at form level', async () => {
    vi.mocked(agentsApi.update).mockRejectedValue(
      new ApiError('Invalid request', 400, ['instructions: demasiado larga', 'name: required']),
    );
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText(/Instrucciones/), ' Más.');
    await user.click(saveButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Invalid request');
    expect(alert.textContent).toContain('name: required');
    expect(alert.textContent).not.toContain('demasiado larga');
    const instructions = screen.getByLabelText(/Instrucciones/);
    expect(instructions.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('demasiado larga').id).toBe(instructions.getAttribute('aria-describedby'));
  });

  it('blocks saving an invalid max tokens value', async () => {
    const user = userEvent.setup();
    mount();
    const tokens = screen.getByLabelText(/Máx. tokens de salida/) as HTMLInputElement;
    await waitFor(() => expect(tokens.disabled).toBe(false));
    await user.type(tokens, '0');
    expect(screen.getByText(/Debe ser un entero/)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('resets the form when switching agent', async () => {
    const user = userEvent.setup();
    const view = mount();
    await user.type(screen.getByLabelText(/Instrucciones/), ' Borrador');
    const other = agentFixture({ id: 'a2', name: 'Lara', instructions: 'Prueba todo.' });
    view.rerender(wrap(<AgentSheet key={other.id} agent={other} onClose={vi.fn()} />));
    expect((screen.getByLabelText(/Instrucciones/) as HTMLTextAreaElement).value).toBe('Prueba todo.');
    expect(saveButton().disabled).toBe(true);
  });
});

describe('AgentSheet enable toggle', () => {
  it('asks before disabling and calls PUT enabled', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(agentsApi.setEnabled).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(agentsApi.setEnabled).toHaveBeenCalledWith('a1', { enabled: false }));
    expect((await screen.findByRole('status')).textContent).toBe('Agente desactivado.');
  });

  it('activates a disabled agent without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    mount({ agent: agentFixture({ enabled: false }) });
    await user.click(screen.getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(agentsApi.setEnabled).toHaveBeenCalledWith('a1', { enabled: true }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('keeps a link to the full editor', () => {
    mount();
    expect(screen.getByRole('link', { name: 'Editor completo' }).getAttribute('href')).toBe(
      '/agents/a1/edit',
    );
  });
});
