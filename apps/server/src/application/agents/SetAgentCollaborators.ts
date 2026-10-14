import type { Agent } from '../../domain/agent/Agent.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import { requireAgent, requireAgentsOfOrganization } from '../shared/lookups.js';

export class SetAgentCollaborators {
  constructor(
    private readonly agents: AgentRepository,
    private readonly clock: Clock,
  ) {}

  execute(agentId: string, collaboratorIds: string[]): Agent {
    const agent = requireAgent(this.agents, agentId);
    requireAgentsOfOrganization(this.agents, agent.organizationId, collaboratorIds);
    agent.setCollaborators(collaboratorIds, this.clock.now());
    this.agents.save(agent);
    return agent;
  }
}
