import type { Agent } from '../../domain/agent/Agent.js';
import type { Project } from '../../domain/project/Project.js';
import type { Task } from '../../domain/task/Task.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { AgentRuntime, CollaboratorInfo, RunUsage, RuntimeEvent } from '../ports/AgentRuntime.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { Clock } from '../ports/Clock.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';
import { requireAgent, requireProject, requireTask } from '../shared/lookups.js';
import type { AgentBriefing } from './AgentBriefing.js';
import type { DelegateSubtask } from './DelegateSubtask.js';
import type { RunningTasks } from './RunningTasks.js';
import { TaskDelegationGateway } from './TaskDelegationGateway.js';
import type { ExecutionOptions, TaskExecutor } from './TaskExecutor.js';
import type { TaskRecorder } from './TaskRecorder.js';

const PROJECT_MANAGER = 'the project manager';

interface RunOutcome {
  resultText: string;
  isError: boolean;
  usage: RunUsage | null;
}

export interface RunTaskDependencies {
  tasks: TaskRepository;
  agents: AgentRepository;
  projects: ProjectRepository;
  runtime: AgentRuntime;
  recorder: TaskRecorder;
  running: RunningTasks;
  briefing: AgentBriefing;
  delegateSubtask: DelegateSubtask;
  clock: Clock;
  ids: IdGenerator;
}

/** Runs a task with its assigned agent until the agent stops, recording the whole conversation. */
export class RunTask implements TaskExecutor {
  constructor(private readonly deps: RunTaskDependencies) {}

  async execute(taskId: string, options: ExecutionOptions = {}): Promise<Task> {
    const { tasks, agents, projects, running, recorder, clock } = this.deps;
    const task = requireTask(tasks, taskId);
    const agent = requireAgent(agents, task.agentId);
    const project = requireProject(projects, task.projectId);
    const isFollowUp = options.followUpMessage !== undefined;
    const prompt = options.followUpMessage ?? this.initialPrompt(task, project);

    task.start(clock.now());
    recorder.recordChange(task);
    recorder.recordMessage(task, { kind: 'user', text: prompt });
    const controller = running.register(task.id, options.parentSignal);
    const startedAt = clock.now();

    try {
      const outcome = await this.runAgent(task, agent, project, prompt, isFollowUp, controller.signal).catch(
        (error: unknown): RunOutcome => ({ resultText: describeError(error), isError: true, usage: null }),
      );
      this.conclude(task, outcome, controller.signal);
      this.recordRun(task, startedAt, outcome);
    } finally {
      running.release(task.id);
      recorder.recordChange(task);
    }
    return task;
  }

  private async runAgent(
    task: Task,
    agent: Agent,
    project: Project,
    prompt: string,
    isFollowUp: boolean,
    signal: AbortSignal,
  ): Promise<RunOutcome> {
    const { runtime, briefing, delegateSubtask, recorder } = this.deps;
    const collaborators = this.collaboratorsOf(agent, project);
    const profile = agent.toSnapshot();
    const events = runtime.run({
      prompt,
      systemPromptAppendix: briefing.systemPromptAppendix({
        agent,
        instructions: profile.instructions,
        collaborators,
      }),
      model: profile.model,
      effort: profile.effort,
      allowedTools: profile.allowedTools,
      permissionMode: profile.permissionMode,
      maxTurns: profile.maxTurns,
      workspacePath: project.workspacePath,
      resumeSessionId: isFollowUp ? task.sessionId : null,
      signal,
      delegation: new TaskDelegationGateway(task, collaborators, delegateSubtask, this, recorder, signal),
    });
    return this.consume(task, events);
  }

  private async consume(task: Task, events: AsyncIterable<RuntimeEvent>): Promise<RunOutcome> {
    const { recorder } = this.deps;
    let outcome: RunOutcome = {
      resultText: 'The agent stopped without a result',
      isError: true,
      usage: null,
    };
    for await (const event of events) {
      switch (event.type) {
        case 'session_started':
          task.attachSession(event.sessionId);
          recorder.recordChange(task);
          break;
        case 'message':
          recorder.recordMessage(task, event.payload);
          break;
        case 'finished':
          outcome = { resultText: event.resultText, isError: event.isError, usage: event.usage };
          break;
      }
    }
    return outcome;
  }

  private conclude(task: Task, outcome: RunOutcome, signal: AbortSignal): void {
    const now = this.deps.clock.now();
    if (signal.aborted) task.cancel(now);
    else if (outcome.isError) task.fail(outcome.resultText, now);
    else task.complete(outcome.resultText, now);
  }

  private recordRun(task: Task, startedAt: Date, outcome: RunOutcome): void {
    const status = task.status;
    if (status !== 'completed' && status !== 'failed' && status !== 'cancelled') return;
    this.deps.recorder.recordRun({
      id: this.deps.ids.next(),
      taskId: task.id,
      startedAt,
      finishedAt: this.deps.clock.now(),
      outcome: status,
      error: status === 'failed' ? task.resultSummary : null,
      numTurns: outcome.usage?.numTurns ?? null,
      models: outcome.usage?.models ?? [],
    });
  }

  private initialPrompt(task: Task, project: Project): string {
    const requester = task.parentTaskId ? this.requesterName(task.parentTaskId) : PROJECT_MANAGER;
    return this.deps.briefing.taskPrompt(task, requester, project.workspacePath);
  }

  private requesterName(parentTaskId: string): string {
    const parent = requireTask(this.deps.tasks, parentTaskId);
    return `your teammate "${requireAgent(this.deps.agents, parent.agentId).name}"`;
  }

  private collaboratorsOf(agent: Agent, project: Project): CollaboratorInfo[] {
    return agent.collaboratorIds
      .filter((id) => project.hasMember(id))
      .map((id) => this.deps.agents.findById(id))
      .filter((collaborator): collaborator is Agent => collaborator !== null)
      .map(({ name, role, description }) => ({ name, role, description }));
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
