import type { Task } from '../../domain/task/Task.js';
import { requireText } from '../../domain/shared/guards.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireTask } from '../shared/lookups.js';
import type { TaskLauncher } from './TaskLauncher.js';
import type { TaskRecorder } from './TaskRecorder.js';

/** The project manager continues the conversation of a task that has stopped. */
export class SendFollowUp {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly recorder: TaskRecorder,
    private readonly launcher: TaskLauncher,
  ) {}

  execute(taskId: string, message: string): Task {
    const followUpMessage = requireText(message, 'message');
    const task = requireTask(this.tasks, taskId);
    task.prepareFollowUp();
    this.recorder.recordChange(task);
    this.launcher.launch(task.id, { followUpMessage });
    return task;
  }
}
