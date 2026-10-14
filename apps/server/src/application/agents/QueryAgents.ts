import type { Agent } from '../../domain/agent/Agent.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import { requireAgent, requireOrganization } from '../shared/lookups.js';

export class ListAgents {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly agents: AgentRepository,
  ) {}

  execute(organizationId: string): Agent[] {
    requireOrganization(this.organizations, organizationId);
    return this.agents.findByOrganization(organizationId);
  }
}

export class GetAgent {
  constructor(private readonly agents: AgentRepository) {}

  execute(agentId: string): Agent {
    return requireAgent(this.agents, agentId);
  }
}
