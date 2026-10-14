import type { Agent } from '../../domain/agent/Agent.js';

export interface AgentRepository {
  save(agent: Agent): void;
  /** Saves all agents, and their collaborator links, atomically. */
  saveAll(agents: readonly Agent[]): void;
  findById(id: string): Agent | null;
  findByName(organizationId: string, name: string): Agent | null;
  findByOrganization(organizationId: string): Agent[];
  delete(id: string): void;
}
