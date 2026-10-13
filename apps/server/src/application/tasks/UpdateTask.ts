import type { UpdateTaskInput } from '@fleet/shared';
import { ValidationError } from '../../domain/errors/DomainError.js';
import type { Task } from '../../domain/task/Task.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireAgent, requireProject, requireRootTask } from '../shared/lookups.js';
import type { TaskRecorder } from './TaskRecorder.js';

/** Edits a task: its definition while it is planned, its milestone and tags at any time. */
export class UpdateTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly agents: AgentRepository,
    private readonly projects: ProjectRepository,
    private readonly recorder: TaskRecorder,
  ) {}

  execute(taskId: string, input: UpdateTaskInput): Task {
    const task = requireRootTask(this.tasks, taskId);
    const { agentId, title, description, milestone, tags } = input;
    if (agentId !== undefined) this.requireProjectMember(task, agentId);
    if (agentId !== undefined || title !== undefined || description !== undefined) {
      task.edit({ agentId, title, description });
    }
    task.retag(milestone, tags);
    this.recorder.recordChange(task);
    return task;
  }

  private requireProjectMember(task: Task, agentId: string): void {
    const agent = requireAgent(this.agents, agentId);
    if (!requireProject(this.projects, task.projectId).hasMember(agent.id)) {
      throw new ValidationError(`"${agent.name}" is not a member of this project`);
    }
  }
}
