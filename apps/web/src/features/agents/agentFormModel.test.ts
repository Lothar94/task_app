import { describe, expect, it } from 'vitest';
import type { AgentDto } from '@fleet/shared';
import {
  addSkill,
  canAddSkill,
  canDraftInstructions,
  EMPTY_AGENT_FORM,
  removeSkill,
  toAgentInput,
  toFormValues,
  toInstructionsBrief,
  validateSkillName,
} from './agentFormModel';

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
      skills: [],
      collaboratorIds: ['a1'],
      guidance: 'Use pytest',
    });
  });

  it('only allows drafting once name and role are filled', () => {
    expect(canDraftInstructions({ ...EMPTY_AGENT_FORM, name: 'QA', role: ' ' })).toBe(false);
    expect(canDraftInstructions({ ...EMPTY_AGENT_FORM, name: 'QA', role: 'Tester' })).toBe(true);
  });

  it('includes skills in the brief and the agent input', () => {
    const values = { ...EMPTY_AGENT_FORM, skills: ['pdf', 'code-review'] };
    expect(toInstructionsBrief(values).skills).toEqual(['pdf', 'code-review']);
    expect(toAgentInput(values).skills).toEqual(['pdf', 'code-review']);
  });

  it('preloads the skills of an existing agent', () => {
    const agent = {
      ...EMPTY_AGENT_FORM,
      id: 'x',
      allowedTools: ['Read'],
      skills: ['pdf'],
    } as unknown as AgentDto;
    expect(toFormValues(agent).skills).toEqual(['pdf']);
    expect(EMPTY_AGENT_FORM.skills).toEqual([]);
  });

  describe('skills', () => {
    it('validates names against the contract', () => {
      expect(validateSkillName('code-review')).toBeNull();
      expect(validateSkillName('Code')).toMatch(/minúsculas/);
      expect(validateSkillName('a--b')).not.toBeNull();
      expect(validateSkillName('a'.repeat(65))).toMatch(/64/);
    });

    it('adds trimmed, unique, valid skills', () => {
      expect(addSkill(['pdf'], '  docx ')).toEqual({ skills: ['pdf', 'docx'], error: null });
      expect(addSkill(['pdf'], 'pdf')).toEqual({ skills: ['pdf'], error: null });
      expect(addSkill(['pdf'], '   ')).toEqual({ skills: ['pdf'], error: null });
    });

    it('rejects invalid names without adding them', () => {
      const result = addSkill(['pdf'], 'Bad Name');
      expect(result.skills).toEqual(['pdf']);
      expect(result.error).not.toBeNull();
    });

    it('blocks more than 20 skills', () => {
      const full = Array.from({ length: 20 }, (_, i) => `skill-${i}`);
      const result = addSkill(full, 'one-more');
      expect(result.skills).toHaveLength(20);
      expect(result.error).toMatch(/20/);
    });

    it('allows adding skills only below the limit', () => {
      expect(canAddSkill(Array.from({ length: 19 }, (_, i) => `skill-${i}`))).toBe(true);
      expect(canAddSkill(Array.from({ length: 20 }, (_, i) => `skill-${i}`))).toBe(false);
    });

    it('removes a skill', () => {
      expect(removeSkill(['a', 'b'], 'a')).toEqual(['b']);
    });
  });
});
