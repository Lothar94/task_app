import type { Agent } from '../../domain/agent/Agent.js';

export interface AgentRepository {
  save(agent: Agent): void;
  findById(id: string): Agent | null;
  findByName(name: string): Agent | null;
  findAll(): Agent[];
  delete(id: string): void;
}
