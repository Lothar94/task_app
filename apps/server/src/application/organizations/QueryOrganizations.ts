import type { Organization } from '../../domain/organization/Organization.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import { requireOrganization } from '../shared/lookups.js';

export class ListOrganizations {
  constructor(private readonly organizations: OrganizationRepository) {}

  execute(): Organization[] {
    return this.organizations.findAll();
  }
}

export class GetOrganization {
  constructor(private readonly organizations: OrganizationRepository) {}

  execute(organizationId: string): Organization {
    return requireOrganization(this.organizations, organizationId);
  }
}
