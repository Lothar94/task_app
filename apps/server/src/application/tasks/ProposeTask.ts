import { ValidationError } from '../../domain/errors/DomainError.js';
import { Task } from '../../domain/task/Task.js';
import type { Agent } from '../../domain/agent/Agent.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { TaskProposal } from '../ports/AgentRuntime.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireActiveProject, requireAgent } from '../shared/lookups.js';
import type { TaskRecorder } from './TaskRecorder.js';

export interface ProposeTaskCommand {
  /** The running task whose agent makes the proposal. */
  proposer: Task;
  request: TaskProposal;
}

/** A running agent suggests a new top-level task: it is only ever a draft, the project manager decides. */
export class ProposeTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly agents: AgentRepository,
    private readonly projects: ProjectRepository,
    private readonly recorder: TaskRecorder,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute({ proposer, request }: ProposeTaskCommand): Task {
    const project = requireActiveProject(this.projects, proposer.projectId);
    const proposingAgent = requireAgent(this.agents, proposer.agentId);
    const assignee = this.resolveAssignee(proposingAgent, request.assigneeName);
    if (!project.hasMember(assignee.id)) {
      throw new ValidationError(`"${assignee.name}" is not a member of this project`);
    }
    const task = Task.createDraft(
      this.ids.next(),
      {
        projectId: project.id,
        number: this.tasks.nextNumber(project.id),
        parentTaskId: null,
        agentId: assignee.id,
        title: request.title,
        description: request.description,
        milestone: request.milestone,
        tags: request.tags,
        proposedByAgentId: proposingAgent.id,
      },
      this.clock.now(),
    );
    this.recorder.recordNew(task);
    return task;
  }

  private resolveAssignee(proposingAgent: Agent, assigneeName: string | undefined): Agent {
    const name = assigneeName?.trim();
    if (!name) return proposingAgent;
    const assignee = this.agents.findByName(proposingAgent.organizationId, name);
    if (!assignee) throw new ValidationError(`"${name}" is not a member of this project`);
    return assignee;
  }
}
