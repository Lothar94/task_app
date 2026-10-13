import type { Agent } from '../../domain/agent/Agent.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import { requireAgent, requireAgents } from '../shared/lookups.js';

export class SetAgentCollaborators {
  constructor(
    private readonly agents: AgentRepository,
    private readonly clock: Clock,
  ) {}

  execute(agentId: string, collaboratorIds: string[]): Agent {
    const agent = requireAgent(this.agents, agentId);
    requireAgents(this.agents, collaboratorIds);
    agent.setCollaborators(collaboratorIds, this.clock.now());
    this.agents.save(agent);
    return agent;
  }
}
