import { ConflictError } from '../../domain/errors/DomainError.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';

export function ensureUniqueOrganizationName(
  organizations: OrganizationRepository,
  name: string,
  ownId?: string,
): void {
  const existing = organizations.findByName(name);
  if (existing && existing.id !== ownId) {
    throw new ConflictError(`An organization named "${name}" already exists`);
  }
}
