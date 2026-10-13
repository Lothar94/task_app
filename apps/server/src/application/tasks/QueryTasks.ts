import type { TaskNodeDto } from '@fleet/shared';
import type { ConversationMessage } from '../../domain/conversation/ConversationMessage.js';
import type { Task } from '../../domain/task/Task.js';
import type { ConversationRepository } from '../ports/ConversationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import type { TaskRunRepository } from '../ports/TaskRunRepository.js';
import { groupBy, summarizeRuns } from '../metrics/usageMath.js';
import { toTaskDto } from '../shared/dtos.js';
import { requireProject, requireTask } from '../shared/lookups.js';

export class GetTask {
  constructor(private readonly tasks: TaskRepository) {}

  execute(taskId: string): Task {
    return requireTask(this.tasks, taskId);
  }
}

export class GetTaskConversation {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly conversations: ConversationRepository,
  ) {}

  execute(taskId: string): ConversationMessage[] {
    requireTask(this.tasks, taskId);
    return this.conversations.findByTask(taskId);
  }
}

/** Returns the project's tasks as a forest: root tasks with their delegated subtasks nested. */
export class GetTaskTree {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly runs: TaskRunRepository,
  ) {}

  execute(projectId: string): TaskNodeDto[] {
    requireProject(this.projects, projectId);
    const runsByTask = groupBy(this.runs.findByProject(projectId), (run) => run.taskId);
    const nodes = this.tasks.findByProject(projectId).map((task) => ({
      ...toTaskDto(task),
      metrics: summarizeRuns(runsByTask.get(task.id) ?? []),
      children: [] as TaskNodeDto[],
    }));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const roots: TaskNodeDto[] = [];
    for (const node of nodes) {
      const parent = node.parentTaskId ? byId.get(node.parentTaskId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }
}
