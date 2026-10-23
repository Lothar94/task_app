import type { UpdateTaskInput } from '@fleet/shared';
import { ValidationError } from '../../domain/errors/DomainError.js';
import type { Project } from '../../domain/project/Project.js';
import type { Task } from '../../domain/task/Task.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireActiveProject, requireAgent, requireRootTask } from '../shared/lookups.js';
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
    const project = requireActiveProject(this.projects, task.projectId);
    const { agentId, title, description, milestone, tags } = input;
    if (agentId !== undefined) this.requireAssignee(task, project, agentId);
    if (agentId !== undefined || title !== undefined || description !== undefined) {
      task.edit({ agentId, title, description });
    }
    task.retag(milestone, tags);
    this.recorder.recordChange(task);
    return task;
  }

  /** A project member; reassigning to a different agent also requires it to be enabled. */
  private requireAssignee(task: Task, project: Project, agentId: string): void {
    const agent = requireAgent(this.agents, agentId);
    if (!project.hasMember(agent.id)) {
      throw new ValidationError(`"${agent.name}" is not a member of this project`);
    }
    if (agent.id !== task.agentId) agent.ensureCanReceiveTasks();
  }
}
