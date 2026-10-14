import { ConflictError } from '../../domain/errors/DomainError.js';
import type { AgentRepository } from '../ports/AgentRepository.js';

export function ensureUniqueAgentName(
  agents: AgentRepository,
  organizationId: string,
  name: string,
  ownId?: string,
): void {
  const existing = agents.findByName(organizationId, name.trim());
  if (existing && existing.id !== ownId) {
    throw new ConflictError(`An agent named "${name.trim()}" already exists in this organization`);
  }
}
