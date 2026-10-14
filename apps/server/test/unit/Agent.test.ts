import { describe, expect, it } from 'vitest';
import { Agent } from '../../src/domain/agent/Agent.js';
import { ValidationError } from '../../src/domain/errors/DomainError.js';
import { profile } from '../support/testFleet.js';

const now = new Date();

describe('Agent', () => {
  it('normalises its profile', () => {
    const agent = Agent.create(
      'a1',
      'org',
      profile('  Backend ', { allowedTools: ['Read', ' Read', ''] }),
      now,
    );
    expect(agent.name).toBe('Backend');
    expect(agent.toSnapshot().allowedTools).toEqual(['Read']);
  });

  it('keeps the chosen effort level', () => {
    const agent = Agent.create('a1', 'org', profile('CTO', { effort: 'max' }), now);
    expect(agent.toSnapshot().effort).toBe('max');
  });

  it('cannot collaborate with itself', () => {
    const agent = Agent.create('a1', 'org', profile('CTO'), now);
    expect(() => agent.setCollaborators(['a1'], now)).toThrow(ValidationError);
  });

  it('knows whom it can delegate to', () => {
    const agent = Agent.create('a1', 'org', profile('CTO'), now);
    agent.setCollaborators(['a2', 'a2'], now);
    expect(agent.collaboratorIds).toEqual(['a2']);
    expect(agent.canDelegateTo('a2')).toBe(true);
    agent.removeCollaborator('a2', now);
    expect(agent.canDelegateTo('a2')).toBe(false);
  });

  it('rejects an out-of-range turn limit', () => {
    expect(() => Agent.create('a1', 'org', profile('CTO', { maxTurns: 0 }), now)).toThrow(ValidationError);
  });

  describe('skills', () => {
    const skillsOf = (skills: string[]) =>
      Agent.create('a1', 'org', profile('Lara', { skills }), now).toSnapshot().skills;

    it('trims, drops empty entries and removes duplicates', () => {
      expect(skillsOf([' graphify ', '', 'graphify', 'pdf-tools'])).toEqual(['graphify', 'pdf-tools']);
    });

    it.each([
      ['uppercase', 'Graphify'],
      ['spaces', 'my skill'],
      ['double hyphen', 'a--b'],
      ['leading hyphen', '-a'],
      ['trailing hyphen', 'a-'],
      ['plugin prefix', 'plugin:skill'],
      ['too long', 'a'.repeat(65)],
    ])('rejects a skill name with %s', (_case, name) => {
      expect(() => skillsOf([name])).toThrow(ValidationError);
      expect(() => skillsOf([name])).toThrow(`"${name}"`);
    });

    it('accepts a name of exactly 64 characters', () => {
      expect(skillsOf(['a'.repeat(64)])).toHaveLength(1);
    });

    it('rejects more than 20 skills but accepts 20', () => {
      const names = (count: number) => Array.from({ length: count }, (_, i) => `skill-${i}`);
      expect(skillsOf(names(20))).toHaveLength(20);
      expect(() => skillsOf(names(21))).toThrow(/at most 20/);
    });

    it('applies the same rules when the profile is updated', () => {
      const agent = Agent.create('a1', 'org', profile('Lara'), now);
      agent.updateProfile(profile('Lara', { skills: ['pdf'] }), now);
      expect(agent.skills).toEqual(['pdf']);
      expect(() => agent.updateProfile(profile('Lara', { skills: ['PDF'] }), now)).toThrow(ValidationError);
    });
  });
});
