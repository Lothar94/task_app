// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { tasksApi } from '../../api/tasksApi';
import { downloadCsv } from '../../lib/download';
import { errorRow } from './dashboardFixtures';
import { ErrorsCard } from './ErrorsCard';

vi.mock('../../api/tasksApi', () => ({ tasksApi: { retry: vi.fn() } }));
vi.mock('../../lib/download', () => ({ downloadCsv: vi.fn() }));

const retry = vi.mocked(tasksApi.retry);
const errors = [
  errorRow({
    runId: 'a',
    taskId: 't-a',
    taskNumber: 1,
    taskTitle: 'Primera',
    cause: 'rate_limit',
    retryable: true,
  }),
  errorRow({ runId: 'b', taskId: 't-b', taskNumber: 2, taskTitle: 'Segunda', cause: 'interrupted' }),
  errorRow({ runId: 'c', taskId: 't-c', taskNumber: 3, taskTitle: 'Tercera', cause: 'interrupted' }),
];
const errorCauses = [
  { cause: 'interrupted' as const, count: 4 },
  { cause: 'rate_limit' as const, count: 1 },
];

let client: QueryClient;
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ErrorsCard errors={errors} errorsTotal={5} errorCauses={errorCauses} days={7} />
      </MemoryRouter>
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
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
});
afterEach(cleanup);

describe('ErrorsCard', () => {
  it('shows the total, the diagnosis and how many are listed', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Errores (5)' })).toBeTruthy();
    expect(screen.getByText(/4× Interrumpida, 1× Rate limit/)).toBeTruthy();
    expect(screen.getByText('Mostrando las 3 más recientes de 5.')).toBeTruthy();
  });

  it('offers a retry button only on retryable errors', () => {
    mount();
    expect(screen.getAllByRole('button', { name: /^Reintentar tarea/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Reintentar tarea 1: Primera' })).toBeTruthy();
  });

  it('filters the list by cause with an accessible radio group', async () => {
    mount();
    const group = screen.getByRole('radiogroup', { name: 'Filtrar errores por causa' });
    await userEvent.click(within(group).getByRole('radio', { name: /Interrumpida/ }));
    expect(screen.queryByText(/Primera/)).toBeNull();
    expect(screen.getByText(/Segunda/)).toBeTruthy();
    expect(screen.getByText(/Tercera/)).toBeTruthy();
    await userEvent.click(within(group).getByRole('radio', { name: /Todas/ }));
    expect(screen.getByText(/Primera/)).toBeTruthy();
  });

  it('exports the listed errors as CSV', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, csv] = vi.mocked(downloadCsv).mock.calls[0] ?? [];
    expect(fileName).toMatch(/^errores-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv?.split('\r\n')).toHaveLength(4);
    expect(csv).toContain('#1 Primera');
  });

  it('exports only the filtered errors', async () => {
    mount();
    await userEvent.click(screen.getByRole('radio', { name: /Rate limit/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(vi.mocked(downloadCsv).mock.calls[0]?.[1]?.split('\r\n')).toHaveLength(2);
  });

  describe('retry flow', () => {
    const open = () => userEvent.click(screen.getByRole('button', { name: 'Reintentar tarea 1: Primera' }));

    it('asks for confirmation and does not retry on its own', async () => {
      mount();
      await open();
      expect(screen.getByRole('dialog', { name: 'Reintentar tarea 1' })).toBeTruthy();
      expect(retry).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(retry).not.toHaveBeenCalled();
    });

    it('retries after confirming, refreshes the dashboard and closes', async () => {
      retry.mockResolvedValue({ id: 't-a', projectId: 'p1' } as Awaited<ReturnType<typeof tasksApi.retry>>);
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      mount();
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar reintento' }));
      await waitFor(() => expect(retry).toHaveBeenCalledWith('t-a'));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar reintento' })).toBeNull());
      const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
      expect(keys).toContainEqual(['dashboard']);
      expect(keys).toContainEqual(['tasks', 't-a']);
      expect(keys).toContainEqual(['task-tree', 'p1']);
    });

    it('shows the error and stays open when the retry is refused', async () => {
      retry.mockRejectedValue(new Error('La tarea ya no se puede reintentar'));
      mount();
      await open();
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar reintento' }));
      expect((await screen.findByRole('alert')).textContent).toContain('La tarea ya no se puede reintentar');
      expect(screen.getByRole('button', { name: 'Confirmar reintento' })).toBeTruthy();
    });
  });
});
