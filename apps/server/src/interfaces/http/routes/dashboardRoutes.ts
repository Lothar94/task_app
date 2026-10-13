import type { FastifyInstance } from 'fastify';
import type { GetUsageDashboard } from '../../../application/metrics/GetUsageDashboard.js';
import { dashboardQuery } from '../schemas.js';

export interface DashboardUseCases {
  getUsageDashboard: GetUsageDashboard;
}

export function registerDashboardRoutes(app: FastifyInstance, useCases: DashboardUseCases): void {
  app.get('/api/dashboard', (request) => {
    const { projectId, days } = dashboardQuery.parse(request.query);
    return useCases.getUsageDashboard.execute({ projectId: projectId ?? null, days: days ?? null });
  });
}
