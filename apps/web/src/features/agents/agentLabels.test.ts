import { describe, expect, it } from 'vitest';
import { modelEffortText, modelFieldLabels, modelText } from './agentLabels';

describe('agent labels', () => {
  it('shows the plain model for fixed agents', () => {
    expect(modelText({ model: 'sonnet', modelSelection: 'fixed' })).toBe('sonnet');
    expect(modelEffortText({ model: 'sonnet', effort: 'high', modelSelection: 'fixed' })).toBe('sonnet · alta');
  });

  it('marks auto agents and calls their model the default', () => {
    expect(modelText({ model: 'sonnet', modelSelection: 'auto' })).toBe('Auto · sonnet por defecto');
    expect(modelEffortText({ model: 'haiku', effort: 'low', modelSelection: 'auto' })).toBe(
      'Auto · haiku por defecto · baja',
    );
  });

  it('renames the form fields for auto agents', () => {
    expect(modelFieldLabels('fixed')).toEqual({ model: 'Modelo', effort: 'Intensidad' });
    expect(modelFieldLabels('auto')).toEqual({ model: 'Modelo por defecto', effort: 'Esfuerzo por defecto' });
  });
});
