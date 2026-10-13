import type { FastifyInstance } from 'fastify';
import type { CreateProject } from '../../../application/projects/CreateProject.js';
import type { GetProject, ListProjects } from '../../../application/projects/QueryProjects.js';
import type { SetProjectMembers } from '../../../application/projects/SetProjectMembers.js';
import { toProjectDto } from '../../../application/shared/dtos.js';
import { createProjectSchema, idParams, membersSchema } from '../schemas.js';

export interface ProjectUseCases {
  createProject: CreateProject;
  listProjects: ListProjects;
  getProject: GetProject;
  setProjectMembers: SetProjectMembers;
}

export function registerProjectRoutes(app: FastifyInstance, useCases: ProjectUseCases): void {
  app.get('/api/projects', () => useCases.listProjects.execute().map(toProjectDto));

  app.get('/api/projects/:id', (request) => {
    const { id } = idParams.parse(request.params);
    return toProjectDto(useCases.getProject.execute(id));
  });

  app.post('/api/projects', (request, reply) => {
    const { memberIds, ...details } = createProjectSchema.parse(request.body);
    const project = useCases.createProject.execute({ details, memberIds });
    return reply.status(201).send(toProjectDto(project));
  });

  app.put('/api/projects/:id/agents', (request) => {
    const { id } = idParams.parse(request.params);
    const { memberIds } = membersSchema.parse(request.body);
    return toProjectDto(useCases.setProjectMembers.execute(id, memberIds));
  });
}
