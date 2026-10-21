import type { AgentDto } from '@fleet/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ModelChoiceFields } from './ModelChoiceFields';
import { EMPTY_MODEL_CHOICE } from './taskFormModel';

const agent = { model: 'sonnet', effort: 'high', modelSelection: 'auto' } as AgentDto;

describe('ModelChoiceFields (static render)', () => {
  const html = renderToStaticMarkup(
    <ModelChoiceFields agent={agent} value={EMPTY_MODEL_CHOICE} onChange={() => {}} />,
  );

  it('labels both selects and offers the agent defaults first', () => {
    expect(html).toContain('Modelo');
    expect(html).toContain('Esfuerzo');
    expect(html).toContain('Por defecto del agente (sonnet)');
    expect(html).toContain('Por defecto del agente (alta)');
  });

  it('lists every model', () => {
    for (const model of ['opus', 'sonnet', 'haiku']) expect(html).toContain(`>${model}<`);
  });
});
