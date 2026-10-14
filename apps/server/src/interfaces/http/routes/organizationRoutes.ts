import type { FastifyInstance } from 'fastify';
import type { CreateOrganization } from '../../../application/organizations/CreateOrganization.js';
import type {
  GetOrganization,
  ListOrganizations,
} from '../../../application/organizations/QueryOrganizations.js';
import type { RenameOrganization } from '../../../application/organizations/RenameOrganization.js';
import { toOrganizationDto } from '../../../application/shared/dtos.js';
import { idParams, organizationSchema } from '../schemas.js';

export interface OrganizationUseCases {
  createOrganization: CreateOrganization;
  renameOrganization: RenameOrganization;
  listOrganizations: ListOrganizations;
  getOrganization: GetOrganization;
}

export function registerOrganizationRoutes(app: FastifyInstance, useCases: OrganizationUseCases): void {
  app.get('/api/organizations', () => useCases.listOrganizations.execute().map(toOrganizationDto));

  app.get('/api/organizations/:id', (request) => {
    const { id } = idParams.parse(request.params);
    return toOrganizationDto(useCases.getOrganization.execute(id));
  });

  app.post('/api/organizations', (request, reply) => {
    const { name } = organizationSchema.parse(request.body);
    return reply.status(201).send(toOrganizationDto(useCases.createOrganization.execute(name)));
  });

  app.put('/api/organizations/:id', (request) => {
    const { id } = idParams.parse(request.params);
    const { name } = organizationSchema.parse(request.body);
    return toOrganizationDto(useCases.renameOrganization.execute(id, name));
  });
}
