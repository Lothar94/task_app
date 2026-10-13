import type { FastifyInstance } from 'fastify';
import { toMessageDto, toTaskDto } from '../../../application/shared/dtos.js';
import type { AssignTask } from '../../../application/tasks/AssignTask.js';
import type { CancelTask } from '../../../application/tasks/CancelTask.js';
import type { GetTask, GetTaskConversation, GetTaskTree } from '../../../application/tasks/QueryTasks.js';
import type { SendFollowUp } from '../../../application/tasks/SendFollowUp.js';
import type { DequeueTask } from '../../../application/tasks/DequeueTask.js';
import type { EnqueueTask } from '../../../application/tasks/EnqueueTask.js';
import type { ReorderQueue } from '../../../application/tasks/ReorderQueue.js';
import type { StartTask } from '../../../application/tasks/StartTask.js';
import type { UpdateTask } from '../../../application/tasks/UpdateTask.js';
import {
  assignTaskSchema,
  followUpSchema,
  idParams,
  reorderQueueSchema,
  updateTaskSchema,
} from '../schemas.js';

export interface TaskUseCases {
  assignTask: AssignTask;
  sendFollowUp: SendFollowUp;
  cancelTask: CancelTask;
  updateTask: UpdateTask;
  startTask: StartTask;
  enqueueTask: EnqueueTask;
  dequeueTask: DequeueTask;
  reorderQueue: ReorderQueue;
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

  app.patch('/api/tasks/:id', (request) => {
    const { id } = idParams.parse(request.params);
    return toTaskDto(useCases.updateTask.execute(id, updateTaskSchema.parse(request.body)));
  });

  app.post('/api/tasks/:id/start', (request, reply) => {
    const { id } = idParams.parse(request.params);
    return reply.status(202).send(toTaskDto(useCases.startTask.execute(id)));
  });

  app.post('/api/tasks/:id/enqueue', (request) => {
    const { id } = idParams.parse(request.params);
    return toTaskDto(useCases.enqueueTask.execute(id));
  });

  app.post('/api/tasks/:id/dequeue', (request) => {
    const { id } = idParams.parse(request.params);
    return toTaskDto(useCases.dequeueTask.execute(id));
  });

  app.put('/api/projects/:id/queue', (request) => {
    const { id } = idParams.parse(request.params);
    const { taskIds } = reorderQueueSchema.parse(request.body);
    return useCases.reorderQueue.execute(id, taskIds).map(toTaskDto);
  });
}
