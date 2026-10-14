import { Agent, type AgentProfile } from '../../domain/agent/Agent.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import { requireAgentsOfOrganization, requireOrganization } from '../shared/lookups.js';
import type { DraftAgentInstructions } from './DraftAgentInstructions.js';
import { ensureUniqueAgentName } from './ensureUniqueAgentName.js';

export interface CreateAgentCommand {
  organizationId: string;
  profile: AgentProfile;
  collaboratorIds: string[];
  /** Extra requests for Claude when it has to draft the instructions. */
  instructionsGuidance?: string;
}

/** Creates an agent; when no instructions are given, Claude drafts them from the profile. */
export class CreateAgent {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly agents: AgentRepository,
    private readonly draftInstructions: DraftAgentInstructions,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({
    organizationId,
    profile,
    collaboratorIds,
    instructionsGuidance,
  }: CreateAgentCommand): Promise<Agent> {
    requireOrganization(this.organizations, organizationId);
    ensureUniqueAgentName(this.agents, organizationId, profile.name);
    requireAgentsOfOrganization(this.agents, organizationId, collaboratorIds);
    const instructions =
      profile.instructions.trim() || (await this.draft(profile, collaboratorIds, instructionsGuidance));

    const now = this.clock.now();
    const agent = Agent.create(this.ids.next(), organizationId, { ...profile, instructions }, now);
    agent.setCollaborators(collaboratorIds, now);
    ensureUniqueAgentName(this.agents, organizationId, profile.name);
    this.agents.save(agent);
    return agent;
  }

  private draft(profile: AgentProfile, collaboratorIds: string[], guidance?: string): Promise<string> {
    const { name, role, description, allowedTools } = profile;
    return this.draftInstructions.execute({
      name,
      role,
      description,
      allowedTools,
      collaboratorIds,
      guidance,
    });
  }
}
