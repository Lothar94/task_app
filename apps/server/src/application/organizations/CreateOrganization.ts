import { Organization } from '../../domain/organization/Organization.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import { ensureUniqueOrganizationName } from './ensureUniqueOrganizationName.js';

export class CreateOrganization {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute(name: string): Organization {
    const organization = Organization.create(this.ids.next(), name, this.clock.now());
    ensureUniqueOrganizationName(this.organizations, organization.name);
    this.organizations.save(organization);
    return organization;
  }
}
