import type { FastifyInstance } from 'fastify';
import type { CreateProject } from '../../../application/projects/CreateProject.js';
import type { GetProject, ListProjects } from '../../../application/projects/QueryProjects.js';
import type { ArchiveProject } from '../../../application/projects/ArchiveProject.js';
import type { UnarchiveProject } from '../../../application/projects/UnarchiveProject.js';
import type { SetProjectMembers } from '../../../application/projects/SetProjectMembers.js';
import type { GetProjectsTelemetry } from '../../../application/projects/GetProjectsTelemetry.js';
import type { ResumeProject } from '../../../application/projects/ResumeProject.js';
import { toProjectDto } from '../../../application/shared/dtos.js';
import { createProjectSchema, idParams, membersSchema } from '../schemas.js';

export interface ProjectUseCases {
  createProject: CreateProject;
  listProjects: ListProjects;
  getProject: GetProject;
  setProjectMembers: SetProjectMembers;
  archiveProject: ArchiveProject;
  unarchiveProject: UnarchiveProject;
  getProjectsTelemetry: GetProjectsTelemetry;
  resumeProject: ResumeProject;
}

export function registerProjectRoutes(app: FastifyInstance, useCases: ProjectUseCases): void {
  app.get('/api/organizations/:id/projects', (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.listProjects.execute(id).map(toProjectDto);
  });

  app.get('/api/organizations/:id/projects/telemetry', (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.getProjectsTelemetry.execute(id);
  });

  app.get('/api/projects/:id', (request) => {
    const { id } = idParams.parse(request.params);
    return toProjectDto(useCases.getProject.execute(id));
  });

  app.post('/api/organizations/:id/projects', (request, reply) => {
    const { id: organizationId } = idParams.parse(request.params);
    const { memberIds, ...details } = createProjectSchema.parse(request.body);
    const project = useCases.createProject.execute({ organizationId, details, memberIds });
    return reply.status(201).send(toProjectDto(project));
  });

  app.put('/api/projects/:id/agents', (request) => {
    const { id } = idParams.parse(request.params);
    const { memberIds } = membersSchema.parse(request.body);
    return toProjectDto(useCases.setProjectMembers.execute(id, memberIds));
  });

  app.post('/api/projects/:id/archive', (request) => {
    const { id } = idParams.parse(request.params);
    return toProjectDto(useCases.archiveProject.execute(id));
  });

  app.post('/api/projects/:id/unarchive', (request) => {
    const { id } = idParams.parse(request.params);
    return toProjectDto(useCases.unarchiveProject.execute(id));
  });

  app.post('/api/projects/:id/resume', (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.resumeProject.execute(id);
  });
}
