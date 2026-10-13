import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/domain/errors/DomainError.js';
import { createTestFleet, profile } from '../support/testFleet.js';

describe('agent instructions', () => {
  it('are generated when an agent is created without them', async () => {
    const fleet = createTestFleet();
    const backend = await fleet.useCases.createAgent.execute({
      profile: profile('Backend'),
      collaboratorIds: [],
    });

    const cto = await fleet.useCases.createAgent.execute({
      profile: profile('CTO', { instructions: '   ', role: 'Chief Technology Officer' }),
      collaboratorIds: [backend.id],
    });

    expect(cto.toSnapshot().instructions).toBe('Generated instructions for CTO');
    expect(fleet.instructionWriter.briefs).toEqual([
      {
        name: 'CTO',
        role: 'Chief Technology Officer',
        description: '',
        allowedTools: ['Read'],
        collaborators: [{ name: 'Backend', role: 'Backend role' }],
        guidance: '',
      },
    ]);
  });

  it('keep what the project manager wrote', async () => {
    const fleet = createTestFleet();
    const agent = await fleet.useCases.createAgent.execute({
      profile: profile('QA', { instructions: 'Test everything' }),
      collaboratorIds: [],
    });

    expect(agent.toSnapshot().instructions).toBe('Test everything');
    expect(fleet.instructionWriter.briefs).toHaveLength(0);
  });

  it('can be drafted before creating the agent', async () => {
    const fleet = createTestFleet();
    const draft = await fleet.useCases.draftAgentInstructions.execute({
      name: 'Frontend',
      role: 'UI engineer',
      description: '',
      allowedTools: [],
      collaboratorIds: [],
    });
    expect(draft).toBe('Generated instructions for Frontend');
  });

  it('follow the extra guidance of the project manager', async () => {
    const fleet = createTestFleet();
    const draft = await fleet.useCases.draftAgentInstructions.execute({
      name: 'Frontend',
      role: 'UI engineer',
      description: '',
      allowedTools: [],
      collaboratorIds: [],
      guidance: '  Use React and Tailwind ',
    });
    expect(draft).toBe('Generated instructions for Frontend (Use React and Tailwind)');
  });

  it('use the guidance given when creating the agent without instructions', async () => {
    const fleet = createTestFleet();
    const agent = await fleet.useCases.createAgent.execute({
      profile: profile('Docs', { instructions: '' }),
      collaboratorIds: [],
      instructionsGuidance: 'Write in Spanish',
    });
    expect(agent.toSnapshot().instructions).toBe('Generated instructions for Docs (Write in Spanish)');
  });

  it('need at least a name and a role to be drafted', async () => {
    const fleet = createTestFleet();
    await expect(
      fleet.useCases.draftAgentInstructions.execute({
        name: 'Frontend',
        role: ' ',
        description: '',
        allowedTools: [],
        collaboratorIds: [],
      }),
    ).rejects.toThrow(ValidationError);
  });
});
