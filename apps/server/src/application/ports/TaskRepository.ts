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
  existsForAgent(agentId: string): boolean;
}
