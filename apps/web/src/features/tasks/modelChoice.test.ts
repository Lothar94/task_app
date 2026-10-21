import { describe, expect, it } from 'vitest';
import {
  defaultEffortOption,
  defaultModelOption,
  EMPTY_MODEL_CHOICE,
  modelChoicePayload,
  modelChoiceSummary,
} from './taskFormModel';

const auto = { model: 'sonnet', effort: 'medium', modelSelection: 'auto' } as const;
const fixed = { ...auto, modelSelection: 'fixed' } as const;

describe('assign form model choice', () => {
  it('sends nothing for fixed agents, even with a stale choice', () => {
    expect(modelChoicePayload(fixed, { model: 'opus', effort: 'max' })).toEqual({});
    expect(modelChoicePayload(undefined, EMPTY_MODEL_CHOICE)).toEqual({});
  });

  it('sends null for auto agents left on default', () => {
    expect(modelChoicePayload(auto, EMPTY_MODEL_CHOICE)).toEqual({ model: null, effort: null });
  });

  it('sends the picked values for auto agents', () => {
    expect(modelChoicePayload(auto, { model: 'opus', effort: '' })).toEqual({ model: 'opus', effort: null });
  });

  it('describes the agent defaults in the first option', () => {
    expect(defaultModelOption(auto)).toBe('Por defecto del agente (sonnet)');
    expect(defaultEffortOption(auto)).toBe('Por defecto del agente (media)');
  });
});

describe('task detail model choice', () => {
  it('shows nothing for fixed agents', () => {
    expect(modelChoiceSummary(fixed, { model: 'opus', effort: 'high' })).toBeNull();
    expect(modelChoiceSummary(undefined, { model: null, effort: null })).toBeNull();
  });

  it('shows the chosen model and effort', () => {
    expect(modelChoiceSummary(auto, { model: 'sonnet', effort: 'medium' })).toBe(
      'Modelo elegido: sonnet · esfuerzo medium',
    );
    expect(modelChoiceSummary(auto, { model: null, effort: 'high' })).toBe('Esfuerzo elegido: high');
  });

  it('falls back to the defaults message when nothing was chosen', () => {
    expect(modelChoiceSummary(auto, { model: null, effort: null })).toBe(
      'Automático: valores por defecto del agente',
    );
  });
});
