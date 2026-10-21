// @vitest-environment jsdom
import type { AgentDto } from '@fleet/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentForm } from './AgentForm';
import { EMPTY_AGENT_FORM, toAgentInput, toFormValues } from './agentFormModel';

vi.mock('./SkillsField', () => ({ SkillsField: () => null }));
vi.mock('./InstructionsField', () => ({ InstructionsField: () => null }));

afterEach(cleanup);

/** Fields are wrapped in their <label>, whose text also holds options and hints: match on the label's first words. */
const field = {
  get: (text: string) => screen.getByLabelText(new RegExp(`^${text}(?! por defecto)`)),
  query: (text: string) => screen.queryByLabelText(new RegExp(`^${text}(?! por defecto)`)),
};

const renderForm = (initialValues = EMPTY_AGENT_FORM, onSubmit = vi.fn()) => {
  render(
    <AgentForm
      initialValues={{ ...initialValues, name: 'Dev', role: 'Dev' }}
      isNew
      teammates={[]}
      submitLabel="Guardar"
      isSubmitting={false}
      error={null}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

describe('AgentForm model selection (QA W25, W26, W29)', () => {
  it('defaults to fixed with plain labels and no auto hint', () => {
    renderForm();
    const group = screen.getByRole('radiogroup', { name: 'Selección de modelo' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Fija' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Automática' }).getAttribute('aria-checked')).toBe('false');
    expect(field.get('Modelo')).toBeTruthy();
    expect(field.get('Intensidad')).toBeTruthy();
    expect(screen.queryByText(/Quien invoca al agente elige/)).toBeNull();
  });

  it('relabels model and effort as defaults when switching to auto and submits the mode', async () => {
    const onSubmit = renderForm();
    await userEvent.click(screen.getByRole('radio', { name: 'Automática' }));

    expect(screen.getByRole('radio', { name: 'Automática' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText(/^Modelo por defecto/)).toBeTruthy();
    expect(screen.getByLabelText(/^Esfuerzo por defecto/)).toBeTruthy();
    expect(screen.getByText(/Quien invoca al agente elige/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ modelSelection: 'auto' }));
    expect(toAgentInput(onSubmit.mock.calls[0]![0])).toMatchObject({ modelSelection: 'auto' });
  });

  it('reflects the stored mode when editing an auto agent', () => {
    const agent = { ...EMPTY_AGENT_FORM, allowedTools: [], modelSelection: 'auto' } as unknown as AgentDto;
    renderForm(toFormValues(agent));
    expect(screen.getByRole('radio', { name: 'Automática' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText(/^Modelo por defecto/)).toBeTruthy();
  });

  it('is operable with the keyboard (Tab to the radio, Enter selects)', async () => {
    renderForm();
    const auto = screen.getByRole('radio', { name: 'Automática' });
    auto.focus();
    await userEvent.keyboard('{Enter}');
    expect(auto.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(auto);
  });

  it('survives a legacy agent payload without modelSelection', () => {
    const legacy = { ...EMPTY_AGENT_FORM, allowedTools: [] } as unknown as AgentDto;
    delete (legacy as Partial<AgentDto>).modelSelection;
    expect(() => renderForm(toFormValues(legacy))).not.toThrow();
    expect(field.get('Modelo')).toBeTruthy();
  });
});
