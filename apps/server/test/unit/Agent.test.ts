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
});
