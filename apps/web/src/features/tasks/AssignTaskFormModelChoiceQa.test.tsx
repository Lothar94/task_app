// @vitest-environment jsdom
import type { AgentDto } from '@fleet/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignTaskForm } from './AssignTaskForm';
import { TaskModelChoice } from './TaskModelChoice';

const mutate = vi.fn();
let agentsData: AgentDto[] | undefined;
vi.mock('./taskQueries', () => ({ useAssignTask: () => ({ mutate, error: null, isPending: false }) }));
vi.mock('../agents/agentQueries', () => ({ useAgents: () => ({ data: agentsData }) }));

const agent = (id: string, name: string, modelSelection?: 'auto' | 'fixed') =>
  ({ id, name, role: 'Dev', model: 'sonnet', effort: 'high', modelSelection }) as AgentDto;
const fixed = agent('f', 'Fija', 'fixed');
const auto = agent('a', 'Auto', 'auto');

beforeEach(() => mutate.mockClear());
afterEach(cleanup);

/** Fields are wrapped in their <label>, whose text also holds options and hints: match on the label's first words. */
const field = {
  get: (text: string) => screen.getByLabelText(new RegExp(`^${text}(?! por defecto)`)),
  query: (text: string) => screen.queryByLabelText(new RegExp(`^${text}(?! por defecto)`)),
};

const renderForm = (members: AgentDto[]) =>
  render(<AssignTaskForm projectId="p" members={members} milestones={[]} tags={[]} onAssigned={() => {}} />);

const fill = async () => {
  await userEvent.type(field.get('Título'), 'T');
  await userEvent.type(field.get('Descripción'), 'D');
  await userEvent.click(screen.getByRole('button', { name: 'Crear e iniciar' }));
};

describe('AssignTaskForm model choice (QA W27, W29, W30)', () => {
  it('hides the selects for a fixed agent and does not send model/effort', async () => {
    renderForm([fixed]);
    expect(field.query('Modelo')).toBeNull();
    expect(field.query('Esfuerzo')).toBeNull();
    await fill();
    const payload = mutate.mock.calls[0]![0];
    expect(payload).not.toHaveProperty('model');
    expect(payload).not.toHaveProperty('effort');
  });

  it('shows labelled selects for an auto agent with the agent default first and sends null when untouched', async () => {
    renderForm([auto]);
    const model = field.get('Modelo') as HTMLSelectElement;
    expect(model.options[0]!.text).toBe('Por defecto del agente (sonnet)');
    expect((field.get('Esfuerzo') as HTMLSelectElement).options[0]!.text).toBe('Por defecto del agente (alta)');
    await fill();
    expect(mutate.mock.calls[0]![0]).toMatchObject({ model: null, effort: null });
  });

  it('sends the chosen values', async () => {
    renderForm([auto]);
    await userEvent.selectOptions(field.get('Modelo'), 'opus');
    await userEvent.selectOptions(field.get('Esfuerzo'), 'max');
    await fill();
    expect(mutate.mock.calls[0]![0]).toMatchObject({ model: 'opus', effort: 'max' });
  });

  it('toggles the selects when the agent changes and resets the choice', async () => {
    renderForm([auto, fixed]);
    await userEvent.selectOptions(field.get('Modelo'), 'opus');
    await userEvent.selectOptions(field.get('Responsable'), 'f');
    expect(field.query('Modelo')).toBeNull();
    await userEvent.selectOptions(field.get('Responsable'), 'a');
    expect((field.get('Modelo') as HTMLSelectElement).value).toBe('');
  });

  it('keeps focus on the owner select when the model selects appear', async () => {
    renderForm([fixed, auto]);
    const owner = field.get('Responsable');
    await userEvent.selectOptions(owner, 'a');
    expect(field.get('Modelo')).toBeTruthy();
    expect(document.activeElement).toBe(owner);
  });

  it('treats an agent payload without modelSelection as fixed', () => {
    renderForm([agent('x', 'Legacy')]);
    expect(field.query('Modelo')).toBeNull();
  });
});

describe('TaskModelChoice (QA W28, W30)', () => {
  const show = (task: Parameters<typeof TaskModelChoice>[0]['task'], agents: AgentDto[] | undefined) => {
    agentsData = agents;
    return render(<TaskModelChoice task={task} />).container;
  };

  it('shows the chosen model and effort for an auto agent', () => {
    expect(show({ agentId: 'a', modelChoice: { model: 'opus', effort: 'max' } }, [auto]).textContent).toBe(
      'Modelo elegido: opus · esfuerzo max',
    );
  });

  it('shows the automatic default text when nothing was chosen', () => {
    expect(show({ agentId: 'a', modelChoice: { model: null, effort: null } }, [auto]).textContent).toContain('Automático');
  });

  it('renders nothing for fixed agents, unknown agents, unloaded agents', () => {
    expect(show({ agentId: 'f', modelChoice: { model: null, effort: null } }, [fixed]).textContent).toBe('');
    cleanup();
    expect(show({ agentId: 'zz', modelChoice: { model: null, effort: null } }, [auto]).textContent).toBe('');
    cleanup();
    expect(show({ agentId: 'a', modelChoice: { model: null, effort: null } }, undefined).textContent).toBe('');
  });

  // DEFECT D2: modelChoiceSummary reads choice.model without guarding undefined (old server payload). Remove .fails once fixed.
  it.fails('does not crash for a legacy task without modelChoice', () => {
    expect(() => show({ agentId: 'a' } as never, [auto])).not.toThrow();
  });
});
