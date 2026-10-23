import type { Agent } from '../../domain/agent/Agent.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import { requireAgent } from '../shared/lookups.js';

/** Enables or disables an agent; tasks already assigned to it are left as they are. */
export class SetAgentEnabled {
  constructor(
    private readonly agents: AgentRepository,
    private readonly clock: Clock,
  ) {}

  execute(agentId: string, enabled: boolean): Agent {
    const agent = requireAgent(this.agents, agentId);
    agent.setEnabled(enabled, this.clock.now());
    this.agents.save(agent);
    return agent;
  }
}
