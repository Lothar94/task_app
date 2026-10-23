import type { FastifyInstance } from 'fastify';
import type { GetAgentActivity } from '../../../application/fleet/GetAgentActivity.js';
import type { GetFleetStatus } from '../../../application/fleet/GetFleetStatus.js';
import type { ResolveProjectOrganization } from '../../../application/projects/ResolveProjectOrganization.js';
import type { SearchOrganization } from '../../../application/search/SearchOrganization.js';
import { idParams, searchQuery } from '../schemas.js';

export interface ShellUseCases {
  searchOrganization: SearchOrganization;
  getFleetStatus: GetFleetStatus;
  getAgentActivity: GetAgentActivity;
  resolveProjectOrganization: ResolveProjectOrganization;
}

/** Endpoints of the global shell: command palette search, status bar and org chart activity. */
export function registerShellRoutes(app: FastifyInstance, useCases: ShellUseCases): void {
  app.get('/api/organizations/:id/search', (request) => {
    const { id } = idParams.parse(request.params);
    const { q, limit } = searchQuery.parse(request.query);
    return useCases.searchOrganization.execute(id, q, limit);
  });

  app.get('/api/organizations/:id/fleet-status', (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.getFleetStatus.execute(id);
  });

  app.get('/api/organizations/:id/agent-activity', (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.getAgentActivity.execute(id);
  });
}
