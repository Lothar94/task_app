import type { Agent } from '../../domain/agent/Agent.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import { requireAgent } from '../shared/lookups.js';

export class ListAgents {
  constructor(private readonly agents: AgentRepository) {}

  execute(): Agent[] {
    return this.agents.findAll();
  }
}

export class GetAgent {
  constructor(private readonly agents: AgentRepository) {}

  execute(agentId: string): Agent {
    return requireAgent(this.agents, agentId);
  }
}
