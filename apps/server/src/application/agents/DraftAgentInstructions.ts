import { requireText } from '../../domain/shared/guards.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { InstructionWriter } from '../ports/InstructionWriter.js';
import { requireAgents } from '../shared/lookups.js';

export interface DraftInstructionsCommand {
  name: string;
  role: string;
  description: string;
  allowedTools: string[];
  collaboratorIds: string[];
  guidance?: string;
}

/** Proposes instructions for an agent from its name, role, tools and teammates. */
const MAX_GUIDANCE_LENGTH = 4000;

function requireOptionalText(guidance = ''): string {
  return guidance.trim() ? requireText(guidance, 'guidance', MAX_GUIDANCE_LENGTH) : '';
}

export class DraftAgentInstructions {
  constructor(
    private readonly agents: AgentRepository,
    private readonly writer: InstructionWriter,
  ) {}

  async execute(command: DraftInstructionsCommand): Promise<string> {
    const collaborators = requireAgents(this.agents, command.collaboratorIds).map(({ name, role }) => ({
      name,
      role,
    }));
    const instructions = await this.writer.write({
      name: requireText(command.name, 'name', 60),
      role: requireText(command.role, 'role', 120),
      description: command.description.trim(),
      allowedTools: command.allowedTools,
      collaborators,
      guidance: requireOptionalText(command.guidance),
    });
    return requireText(instructions, 'generated instructions');
  }
}
