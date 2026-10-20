// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectsApi } from '../../api/projectsApi';
import { ResumeProjectDialog } from './ResumeProjectDialog';

vi.mock('../organizations/OrganizationContext', () => ({ useCurrentOrganization: () => ({ id: 'org' }) }));
vi.mock('../../api/projectsApi', () => ({ projectsApi: { resume: vi.fn() } }));

const alerts = [
  { kind: 'session_limit' as const, taskIds: ['a', 'b'] },
  { kind: 'token_limit' as const, taskIds: ['c'] },
];
const resume = vi.mocked(projectsApi.resume);
const onClose = vi.fn();

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <ResumeProjectDialog projectId="p1" projectName="Task app" alerts={alerts} onClose={onClose} />
    </QueryClientProvider>,
  );

beforeAll(() => {
  // jsdom has no modal <dialog>.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('ResumeProjectDialog', () => {
  it('lists what will be re-queued and does not resume on its own', () => {
    mount();
    expect(screen.getByText('2 tareas con fallo de sesión')).toBeTruthy();
    expect(screen.getByText('1 tarea con límite de tokens')).toBeTruthy();
    expect(resume).not.toHaveBeenCalled();
  });

  it('cancel closes without calling the mutation', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it('calls the mutation only after confirming, then closes', async () => {
    resume.mockResolvedValue({ requeued: [] });
    mount();
    expect(resume).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reanudación' }));
    await waitFor(() => expect(resume).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the pending state and mutation errors', async () => {
    resume.mockRejectedValue(new Error('El proyecto está archivado'));
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reanudación' }));
    expect((await screen.findByRole('alert')).textContent).toContain('El proyecto está archivado');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables the buttons while pending', async () => {
    resume.mockReturnValue(new Promise(() => undefined));
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reanudación' }));
    const pending = await screen.findByRole('button', { name: 'Reanudando…' });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
