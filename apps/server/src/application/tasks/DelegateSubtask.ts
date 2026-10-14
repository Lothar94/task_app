import type { Agent } from '../../domain/agent/Agent.js';
import { ValidationError } from '../../domain/errors/DomainError.js';
import { Task } from '../../domain/task/Task.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { DelegationOutcome, DelegationRequest } from '../ports/AgentRuntime.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireAgent, requireProject } from '../shared/lookups.js';
import type { TaskExecutor } from './TaskExecutor.js';
import type { TaskRecorder } from './TaskRecorder.js';

export interface DelegateSubtaskCommand {
  parent: Task;
  request: DelegationRequest;
  executor: TaskExecutor;
  signal: AbortSignal;
}

export class DelegateSubtask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly agents: AgentRepository,
    private readonly projects: ProjectRepository,
    private readonly recorder: TaskRecorder,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly maxDepth: number,
  ) {}

  async execute({ parent, request, executor, signal }: DelegateSubtaskCommand): Promise<DelegationOutcome> {
    const collaborator = this.resolveCollaborator(parent, request.collaboratorName);
    this.ensureNoCycle(parent, collaborator);
    const subtask = this.createSubtask(parent, collaborator, request);

    parent.waitForSubtasks();
    this.recorder.recordChange(parent);

    const finished = await executor.execute(subtask.id, { parentSignal: signal });
    this.resumeParentWhenIdle(parent);
    return this.toOutcome(finished);
  }

  private resolveCollaborator(parent: Task, collaboratorName: string): Agent {
    const delegator = requireAgent(this.agents, parent.agentId);
    const collaborator = this.agents.findByName(delegator.organizationId, collaboratorName.trim());
    if (!collaborator || !delegator.canDelegateTo(collaborator.id)) {
      throw new ValidationError(`"${collaboratorName}" is not one of your collaborators`);
    }
    if (!requireProject(this.projects, parent.projectId).hasMember(collaborator.id)) {
      throw new ValidationError(`"${collaborator.name}" is not a member of this project`);
    }
    return collaborator;
  }

  private ensureNoCycle(parent: Task, collaborator: Agent): void {
    const chain = this.ancestry(parent);
    if (chain.length >= this.maxDepth) {
      throw new ValidationError(`Maximum delegation depth (${this.maxDepth}) reached: do this work yourself`);
    }
    if (chain.some((task) => task.agentId === collaborator.id)) {
      throw new ValidationError(
        `"${collaborator.name}" is already working on an ancestor of this task; delegating back would create a cycle`,
      );
    }
  }

  private ancestry(task: Task): Task[] {
    const chain = [task];
    let parentId = task.parentTaskId;
    while (parentId) {
      const ancestor = this.tasks.findById(parentId);
      if (!ancestor) break;
      chain.push(ancestor);
      parentId = ancestor.parentTaskId;
    }
    return chain;
  }

  private createSubtask(parent: Task, collaborator: Agent, request: DelegationRequest): Task {
    const subtask = Task.create(
      this.ids.next(),
      {
        projectId: parent.projectId,
        number: this.tasks.nextNumber(parent.projectId),
        parentTaskId: parent.id,
        agentId: collaborator.id,
        title: request.title,
        description: request.instructions,
      },
      this.clock.now(),
    );
    this.recorder.recordNew(subtask);
    return subtask;
  }

  private resumeParentWhenIdle(parent: Task): void {
    const hasActiveSubtasks = this.tasks.findChildren(parent.id).some((child) => child.isActive);
    if (hasActiveSubtasks || parent.status !== 'waiting_subtasks') return;
    parent.resumeAfterSubtasks();
    this.recorder.recordChange(parent);
  }

  private toOutcome(subtask: Task): DelegationOutcome {
    const status =
      subtask.status === 'completed' || subtask.status === 'cancelled' ? subtask.status : 'failed';
    return {
      subtaskId: subtask.id,
      subtaskNumber: subtask.number,
      status,
      summary: subtask.resultSummary ?? '',
    };
  }
}
