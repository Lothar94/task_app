import type { Task } from '../../domain/task/Task.js';

export interface TaskRepository {
  save(task: Task): void;
  /** Next free task number of the project. */
  nextNumber(projectId: string): number;
  findById(id: string): Task | null;
  findByProject(projectId: string): Task[];
  findAll(): Task[];
  findChildren(parentTaskId: string): Task[];
  findActive(): Task[];
  /** Queued tasks of the project, ordered by queue position. */
  findQueued(projectId: string): Task[];
  findProjectIdsWithQueue(): string[];
  /** Whether a root task (not a subtask) of the project is pending, running or waiting for subtasks. */
  hasActiveRootTask(projectId: string): boolean;
  existsForAgent(agentId: string): boolean;
}
