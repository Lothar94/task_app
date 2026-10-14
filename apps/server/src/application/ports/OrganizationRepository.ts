import type { Organization } from '../../domain/organization/Organization.js';

export interface OrganizationRepository {
  save(organization: Organization): void;
  findById(id: string): Organization | null;
  findByName(name: string): Organization | null;
  /** Oldest first, so the default organization comes first. */
  findAll(): Organization[];
}
