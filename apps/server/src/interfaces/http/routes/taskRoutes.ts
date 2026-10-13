import type { FastifyInstance } from 'fastify';
import { toMessageDto, toTaskDto } from '../../../application/shared/dtos.js';
import type { AssignTask } from '../../../application/tasks/AssignTask.js';
import type { CancelTask } from '../../../application/tasks/CancelTask.js';
import type { GetTask, GetTaskConversation, GetTaskTree } from '../../../application/tasks/QueryTasks.js';
import type { SendFollowUp } from '../../../application/tasks/SendFollowUp.js';
import { assignTaskSchema, followUpSchema, idParams } from '../schemas.js';

export interface TaskUseCases {
  assignTask: AssignTask;
  sendFollowUp: SendFollowUp;
  cancelTask: CancelTask;
  getTask: GetTask;
  getTaskTree: GetTaskTree;
  getTaskConversation: GetTaskConversation;
}

export function registerTaskRoutes(app: FastifyInstance, useCases: TaskUseCases): void {
  app.get('/api/projects/:id/tasks', (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.getTaskTree.execute(id);
  });

  app.post('/api/projects/:id/tasks', (request, reply) => {
    const { id } = idParams.parse(request.params);
    const task = useCases.assignTask.execute(id, assignTaskSchema.parse(request.body));
    return reply.status(201).send(toTaskDto(task));
  });

  app.get('/api/tasks/:id', (request) => {
    const { id } = idParams.parse(request.params);
    return toTaskDto(useCases.getTask.execute(id));
  });

  app.get('/api/tasks/:id/conversation', (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.getTaskConversation.execute(id).map(toMessageDto);
  });

  app.post('/api/tasks/:id/messages', (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { message } = followUpSchema.parse(request.body);
    return reply.status(202).send(toTaskDto(useCases.sendFollowUp.execute(id, message)));
  });

  app.post('/api/tasks/:id/cancel', (request, reply) => {
    const { id } = idParams.parse(request.params);
    useCases.cancelTask.execute(id);
    return reply.status(202).send();
  });
}
