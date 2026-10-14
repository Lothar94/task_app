import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { EventSubscriber } from '../../application/ports/EventBus.js';
import type { Logger } from '../../application/ports/Logger.js';
import { createErrorHandler } from './errorHandler.js';
import { type AgentUseCases, registerAgentRoutes } from './routes/agentRoutes.js';
import { type DashboardUseCases, registerDashboardRoutes } from './routes/dashboardRoutes.js';
import { registerEventRoutes } from './routes/eventRoutes.js';
import { type OrganizationUseCases, registerOrganizationRoutes } from './routes/organizationRoutes.js';
import { type ProjectUseCases, registerProjectRoutes } from './routes/projectRoutes.js';
import { registerSkillRoutes, type SkillUseCases } from './routes/skillRoutes.js';
import { registerTaskRoutes, type TaskUseCases } from './routes/taskRoutes.js';

export interface HttpServerDependencies {
  useCases: OrganizationUseCases &
    AgentUseCases &
    ProjectUseCases &
    TaskUseCases &
    DashboardUseCases &
    SkillUseCases;
  events: EventSubscriber;
  logger: Logger;
  allowedOrigin: string;
}

export async function createHttpServer(deps: HttpServerDependencies): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cors, { origin: deps.allowedOrigin });
  app.setErrorHandler(createErrorHandler(deps.logger));
  registerOrganizationRoutes(app, deps.useCases);
  registerAgentRoutes(app, deps.useCases);
  registerSkillRoutes(app, deps.useCases);
  registerProjectRoutes(app, deps.useCases);
  registerTaskRoutes(app, deps.useCases);
  registerDashboardRoutes(app, deps.useCases);
  registerEventRoutes(app, deps.events);
  return app;
}
