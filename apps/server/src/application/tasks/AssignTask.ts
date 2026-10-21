import type { AssignTaskInput } from '@fleet/shared';
import { ValidationError } from '../../domain/errors/DomainError.js';
import { Task } from '../../domain/task/Task.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireActiveProject, requireAgent } from '../shared/lookups.js';
import type { TaskLauncher } from './TaskLauncher.js';
import type { TaskQueue } from './TaskQueue.js';
import type { TaskRecorder } from './TaskRecorder.js';

export interface AssignTaskDependencies {
  projects: ProjectRepository;
  agents: AgentRepository;
  tasks: TaskRepository;
  recorder: TaskRecorder;
  launcher: TaskLauncher;
  queue: TaskQueue;
  ids: IdGenerator;
  clock: Clock;
}

/** The project manager hands a new task to one of the project's agents: now, as a draft or queued. */
export class AssignTask {
  constructor(private readonly deps: AssignTaskDependencies) {}

  execute(projectId: string, input: AssignTaskInput): Task {
    const { projects, agents, tasks, recorder, launcher, queue, ids, clock } = this.deps;
    const project = requireActiveProject(projects, projectId);
    const agent = requireAgent(agents, input.agentId);
    if (!project.hasMember(agent.id)) {
      throw new ValidationError(`"${agent.name}" is not a member of this project`);
    }
    const newTask = {
      projectId,
      number: tasks.nextNumber(projectId),
      parentTaskId: null,
      agentId: agent.id,
      title: input.title,
      description: input.description,
      milestone: input.milestone,
      tags: input.tags,
      modelChoice:
        agent.modelSelection === 'auto'
          ? { model: input.model ?? null, effort: input.effort ?? null }
          : undefined,
    };
    const id = ids.next();
    const now = clock.now();
    const start = input.start ?? 'now';

    if (start === 'now') {
      const task = Task.create(id, newTask, now);
      recorder.recordNew(task);
      launcher.launch(task.id);
      return task;
    }
    const task = Task.createDraft(id, newTask, now);
    if (start === 'queue') task.enqueue(queue.nextPosition(projectId));
    recorder.recordNew(task);
    if (start === 'queue') queue.process(projectId);
    return task;
  }
}
