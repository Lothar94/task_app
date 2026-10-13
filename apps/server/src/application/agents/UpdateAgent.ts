import type { Agent, AgentProfile } from '../../domain/agent/Agent.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import { requireAgent } from '../shared/lookups.js';
import { ensureUniqueAgentName } from './ensureUniqueAgentName.js';

export class UpdateAgent {
  constructor(
    private readonly agents: AgentRepository,
    private readonly clock: Clock,
  ) {}

  execute(agentId: string, profile: AgentProfile): Agent {
    const agent = requireAgent(this.agents, agentId);
    ensureUniqueAgentName(this.agents, profile.name, agentId);
    agent.updateProfile(profile, this.clock.now());
    this.agents.save(agent);
    return agent;
  }
}
