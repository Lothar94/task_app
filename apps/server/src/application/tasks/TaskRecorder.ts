import type { MessagePayload } from '@fleet/shared';
import type { Task } from '../../domain/task/Task.js';
import type { ConversationRepository } from '../ports/ConversationRepository.js';
import type { EventPublisher } from '../ports/EventBus.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskRunRepository } from '../ports/TaskRunRepository.js';
import type { TaskRun } from '../../domain/task/TaskRun.js';
import { toMessageDto, toTaskDto } from '../shared/dtos.js';

/** Persists task changes and conversation messages, and notifies subscribers about them. */
export class TaskRecorder {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly conversations: ConversationRepository,
    private readonly events: EventPublisher,
    private readonly runs: TaskRunRepository,
  ) {}

  /** Stores the outcome and token usage of one agent run; the task change that follows notifies it. */
  recordRun(run: TaskRun): void {
    this.runs.append(run);
  }

  recordNew(task: Task): void {
    this.tasks.save(task);
    this.events.publish({ type: 'task.created', projectId: task.projectId, task: toTaskDto(task) });
  }

  recordChange(task: Task): void {
    this.tasks.save(task);
    this.events.publish({ type: 'task.updated', projectId: task.projectId, task: toTaskDto(task) });
  }

  recordMessage(task: Task, payload: MessagePayload): void {
    const message = this.conversations.append(task.id, payload);
    this.events.publish({
      type: 'task.message_appended',
      projectId: task.projectId,
      message: toMessageDto(message),
    });
  }
}
