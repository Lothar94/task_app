import { CreateAgent } from '../application/agents/CreateAgent.js';
import { DraftAgentInstructions } from '../application/agents/DraftAgentInstructions.js';
import { DeleteAgent } from '../application/agents/DeleteAgent.js';
import { GetAgent, ListAgents } from '../application/agents/QueryAgents.js';
import { SetAgentCollaborators } from '../application/agents/SetAgentCollaborators.js';
import { UpdateAgent } from '../application/agents/UpdateAgent.js';
import type { AgentRuntime } from '../application/ports/AgentRuntime.js';
import type { InstructionWriter } from '../application/ports/InstructionWriter.js';
import type { Logger } from '../application/ports/Logger.js';
import { GetUsageDashboard } from '../application/metrics/GetUsageDashboard.js';
import { CreateProject } from '../application/projects/CreateProject.js';
import { GetProject, ListProjects } from '../application/projects/QueryProjects.js';
import { SetProjectMembers } from '../application/projects/SetProjectMembers.js';
import { AgentBriefing } from '../application/tasks/AgentBriefing.js';
import { AssignTask } from '../application/tasks/AssignTask.js';
import { CancelTask } from '../application/tasks/CancelTask.js';
import { DelegateSubtask } from '../application/tasks/DelegateSubtask.js';
import { GetTask, GetTaskConversation, GetTaskTree } from '../application/tasks/QueryTasks.js';
import { RecoverInterruptedTasks } from '../application/tasks/RecoverInterruptedTasks.js';
import { RunningTasks } from '../application/tasks/RunningTasks.js';
import { RunTask } from '../application/tasks/RunTask.js';
import { SendFollowUp } from '../application/tasks/SendFollowUp.js';
import { TaskLauncher } from '../application/tasks/TaskLauncher.js';
import { TaskRecorder } from '../application/tasks/TaskRecorder.js';
import { InMemoryEventBus } from '../infrastructure/events/InMemoryEventBus.js';
import type { SqliteDatabase } from '../infrastructure/persistence/sqlite/openDatabase.js';
import { SqliteAgentRepository } from '../infrastructure/persistence/sqlite/SqliteAgentRepository.js';
import { SqliteConversationRepository } from '../infrastructure/persistence/sqlite/SqliteConversationRepository.js';
import { SqliteProjectRepository } from '../infrastructure/persistence/sqlite/SqliteProjectRepository.js';
import { SqliteTaskRunRepository } from '../infrastructure/persistence/sqlite/SqliteTaskRunRepository.js';
import { SqliteTaskRepository } from '../infrastructure/persistence/sqlite/SqliteTaskRepository.js';
import { FileSystemWorkspaceProvisioner } from '../infrastructure/system/FileSystemWorkspaceProvisioner.js';
import { SystemClock } from '../infrastructure/system/SystemClock.js';
import { UuidGenerator } from '../infrastructure/system/UuidGenerator.js';

export interface ContainerOptions {
  db: SqliteDatabase;
  runtime: AgentRuntime;
  instructionWriter: InstructionWriter;
  logger: Logger;
  maxDelegationDepth: number;
  reservedPorts?: number[];
}

interface Infrastructure {
  ids: UuidGenerator;
  clock: SystemClock;
  agents: SqliteAgentRepository;
  projects: SqliteProjectRepository;
  tasks: SqliteTaskRepository;
  recorder: TaskRecorder;
}

/** Wires the execution of tasks: running agents, delegation and cancellation. */
function createTaskExecution(
  { ids, clock, agents, projects, tasks, recorder }: Infrastructure,
  { runtime, logger, maxDelegationDepth, reservedPorts = [] }: ContainerOptions,
) {
  const running = new RunningTasks();
  const delegateSubtask = new DelegateSubtask(
    tasks,
    agents,
    projects,
    recorder,
    ids,
    clock,
    maxDelegationDepth,
  );
  const runTask = new RunTask({
    tasks,
    agents,
    projects,
    runtime,
    recorder,
    running,
    briefing: new AgentBriefing(reservedPorts),
    delegateSubtask,
    clock,
    ids,
  });
  return { running, launcher: new TaskLauncher(runTask, logger) };
}

/** Composition root: the only place that knows every concrete implementation. */
export function createContainer(options: ContainerOptions) {
  const { db, instructionWriter } = options;
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const events = new InMemoryEventBus();

  const agents = new SqliteAgentRepository(db);
  const projects = new SqliteProjectRepository(db);
  const tasks = new SqliteTaskRepository(db);
  const conversations = new SqliteConversationRepository(db, ids, clock);
  const runs = new SqliteTaskRunRepository(db);
  const recorder = new TaskRecorder(tasks, conversations, events, runs);
  const { running, launcher } = createTaskExecution(
    { ids, clock, agents, projects, tasks, recorder },
    options,
  );
  const draftAgentInstructions = new DraftAgentInstructions(agents, instructionWriter);

  return {
    events,
    recoverInterruptedTasks: new RecoverInterruptedTasks(tasks, recorder, ids, clock),
    useCases: {
      createAgent: new CreateAgent(agents, draftAgentInstructions, ids, clock),
      draftAgentInstructions,
      updateAgent: new UpdateAgent(agents, clock),
      deleteAgent: new DeleteAgent(agents, projects, tasks, clock),
      listAgents: new ListAgents(agents),
      getAgent: new GetAgent(agents),
      setAgentCollaborators: new SetAgentCollaborators(agents, clock),
      createProject: new CreateProject(projects, agents, new FileSystemWorkspaceProvisioner(), ids, clock),
      listProjects: new ListProjects(projects),
      getProject: new GetProject(projects),
      setProjectMembers: new SetProjectMembers(projects, agents),
      assignTask: new AssignTask(projects, agents, tasks, recorder, launcher, ids, clock),
      sendFollowUp: new SendFollowUp(tasks, recorder, launcher),
      cancelTask: new CancelTask(tasks, running, recorder, clock),
      getTask: new GetTask(tasks),
      getTaskTree: new GetTaskTree(projects, tasks, runs),
      getUsageDashboard: new GetUsageDashboard(tasks, runs, agents, projects, clock),
      getTaskConversation: new GetTaskConversation(tasks, conversations),
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
