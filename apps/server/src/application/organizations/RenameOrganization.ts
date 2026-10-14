import type { Organization } from '../../domain/organization/Organization.js';
import type { Clock } from '../ports/Clock.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import { requireOrganization } from '../shared/lookups.js';
import { ensureUniqueOrganizationName } from './ensureUniqueOrganizationName.js';

export class RenameOrganization {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly clock: Clock,
  ) {}

  execute(organizationId: string, name: string): Organization {
    const organization = requireOrganization(this.organizations, organizationId);
    organization.rename(name, this.clock.now());
    ensureUniqueOrganizationName(this.organizations, organization.name, organization.id);
    this.organizations.save(organization);
    return organization;
  }
}
