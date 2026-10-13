import { describe, expect, it } from 'vitest';
import { canDraftInstructions, EMPTY_AGENT_FORM, toInstructionsBrief } from './agentFormModel';

describe('agent form model', () => {
  it('builds the brief Claude needs to draft instructions', () => {
    const values = {
      ...EMPTY_AGENT_FORM,
      name: 'QA',
      role: 'Tester',
      allowedTools: 'Read, Bash\nGrep',
      collaboratorIds: ['a1'],
      instructionsGuidance: 'Use pytest',
    };
    expect(toInstructionsBrief(values)).toEqual({
      name: 'QA',
      role: 'Tester',
      description: '',
      allowedTools: ['Read', 'Bash', 'Grep'],
      collaboratorIds: ['a1'],
      guidance: 'Use pytest',
    });
  });

  it('only allows drafting once name and role are filled', () => {
    expect(canDraftInstructions({ ...EMPTY_AGENT_FORM, name: 'QA', role: ' ' })).toBe(false);
    expect(canDraftInstructions({ ...EMPTY_AGENT_FORM, name: 'QA', role: 'Tester' })).toBe(true);
  });
});
