import type { FastifyInstance } from 'fastify';
import type { GetUsageDashboard } from '../../../application/metrics/GetUsageDashboard.js';
import { dashboardQuery, idParams } from '../schemas.js';

export interface DashboardUseCases {
  getUsageDashboard: GetUsageDashboard;
}

export function registerDashboardRoutes(app: FastifyInstance, useCases: DashboardUseCases): void {
  app.get('/api/organizations/:id/dashboard', (request) => {
    const { id } = idParams.parse(request.params);
    const { projectId, days } = dashboardQuery.parse(request.query);
    return useCases.getUsageDashboard.execute(id, { projectId: projectId ?? null, days: days ?? null });
  });
}
