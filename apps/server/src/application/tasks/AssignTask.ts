import type { AssignTaskInput } from '@fleet/shared';
import { ValidationError } from '../../domain/errors/DomainError.js';
import { Task } from '../../domain/task/Task.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireAgent, requireProject } from '../shared/lookups.js';
import type { TaskLauncher } from './TaskLauncher.js';
import type { TaskRecorder } from './TaskRecorder.js';

/** The project manager hands a new task to one of the project's agents. */
export class AssignTask {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly agents: AgentRepository,
    private readonly tasks: TaskRepository,
    private readonly recorder: TaskRecorder,
    private readonly launcher: TaskLauncher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute(projectId: string, input: AssignTaskInput): Task {
    const project = requireProject(this.projects, projectId);
    const agent = requireAgent(this.agents, input.agentId);
    if (!project.hasMember(agent.id)) {
      throw new ValidationError(`"${agent.name}" is not a member of this project`);
    }
    const task = Task.create(
      this.ids.next(),
      {
        projectId,
        number: this.tasks.nextNumber(projectId),
        parentTaskId: null,
        agentId: agent.id,
        title: input.title,
        description: input.description,
      },
      this.clock.now(),
    );
    this.recorder.recordNew(task);
    this.launcher.launch(task.id);
    return task;
  }
}
