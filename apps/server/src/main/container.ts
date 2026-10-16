import { CreateOrganization } from '../application/organizations/CreateOrganization.js';
import { GetOrganization, ListOrganizations } from '../application/organizations/QueryOrganizations.js';
import { RenameOrganization } from '../application/organizations/RenameOrganization.js';
import { CreateAgent } from '../application/agents/CreateAgent.js';
import { DraftAgentInstructions } from '../application/agents/DraftAgentInstructions.js';
import { DeleteAgent } from '../application/agents/DeleteAgent.js';
import { ExportAgents } from '../application/agents/ExportAgents.js';
import { ImportAgents } from '../application/agents/ImportAgents.js';
import { GetAgent, ListAgents } from '../application/agents/QueryAgents.js';
import { SetAgentCollaborators } from '../application/agents/SetAgentCollaborators.js';
import { UpdateAgent } from '../application/agents/UpdateAgent.js';
import type { AgentRuntime } from '../application/ports/AgentRuntime.js';
import type { InstructionWriter } from '../application/ports/InstructionWriter.js';
import type { SkillCatalog } from '../application/ports/SkillCatalog.js';
import type { SkillWorkspace } from '../application/ports/SkillWorkspace.js';
import { ListSkills } from '../application/skills/ListSkills.js';
import type { Logger } from '../application/ports/Logger.js';
import { GetUsageDashboard } from '../application/metrics/GetUsageDashboard.js';
import { CreateProject } from '../application/projects/CreateProject.js';
import { GetProject, ListProjects } from '../application/projects/QueryProjects.js';
import { ArchiveProject } from '../application/projects/ArchiveProject.js';
import { UnarchiveProject } from '../application/projects/UnarchiveProject.js';
import { SetProjectMembers } from '../application/projects/SetProjectMembers.js';
import { AgentBriefing } from '../application/tasks/AgentBriefing.js';
import { AssignTask } from '../application/tasks/AssignTask.js';
import { CancelTask } from '../application/tasks/CancelTask.js';
import { ProposeTask } from '../application/tasks/ProposeTask.js';
import { DelegateSubtask } from '../application/tasks/DelegateSubtask.js';
import { GetTask, GetTaskConversation, GetTaskTree } from '../application/tasks/QueryTasks.js';
import { DequeueTask } from '../application/tasks/DequeueTask.js';
import { EnqueueTask } from '../application/tasks/EnqueueTask.js';
import { ReorderQueue } from '../application/tasks/ReorderQueue.js';
import { StartTask } from '../application/tasks/StartTask.js';
import { TaskQueue } from '../application/tasks/TaskQueue.js';
import { UpdateTask } from '../application/tasks/UpdateTask.js';
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
import { SqliteOrganizationRepository } from '../infrastructure/persistence/sqlite/SqliteOrganizationRepository.js';
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
  skillCatalog: SkillCatalog;
  skillWorkspace: SkillWorkspace;
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
  { runtime, skillWorkspace, logger, maxDelegationDepth, reservedPorts = [] }: ContainerOptions,
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
  const proposeTask = new ProposeTask(tasks, agents, projects, recorder, ids, clock);
  const runTask = new RunTask({
    tasks,
    agents,
    projects,
    runtime,
    recorder,
    running,
    briefing: new AgentBriefing(reservedPorts),
    skillWorkspace,
    delegateSubtask,
    proposeTask,
    clock,
    ids,
  });
  return { running, launcher: new TaskLauncher(runTask, logger) };
}

function createOrganizationUseCases(
  organizations: SqliteOrganizationRepository,
  ids: UuidGenerator,
  clock: SystemClock,
) {
  return {
    createOrganization: new CreateOrganization(organizations, ids, clock),
    renameOrganization: new RenameOrganization(organizations, clock),
    listOrganizations: new ListOrganizations(organizations),
    getOrganization: new GetOrganization(organizations),
  };
}

function createAgentTransferUseCases(
  organizations: SqliteOrganizationRepository,
  agents: SqliteAgentRepository,
  ids: UuidGenerator,
  clock: SystemClock,
) {
  return {
    exportAgents: new ExportAgents(organizations, agents, clock),
    importAgents: new ImportAgents(organizations, agents, ids, clock),
  };
}

function createProjectMemberAndArchiveUseCases(
  projects: SqliteProjectRepository,
  agents: SqliteAgentRepository,
  tasks: SqliteTaskRepository,
  clock: SystemClock,
) {
  return {
    setProjectMembers: new SetProjectMembers(projects, agents),
    archiveProject: new ArchiveProject(projects, tasks, clock),
    unarchiveProject: new UnarchiveProject(projects),
  };
}

/** Composition root: the only place that knows every concrete implementation. */
export function createContainer(options: ContainerOptions) {
  const { db, instructionWriter, skillCatalog } = options;
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const events = new InMemoryEventBus();

  const organizations = new SqliteOrganizationRepository(db);
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
  const queue = new TaskQueue(tasks, recorder, launcher);
  queue.watch(events);
  const draftAgentInstructions = new DraftAgentInstructions(agents, instructionWriter);

  return {
    events,
    processTaskQueues: () => queue.processAll(),
    recoverInterruptedTasks: new RecoverInterruptedTasks(tasks, recorder, ids, clock),
    useCases: {
      ...createOrganizationUseCases(organizations, ids, clock),
      createAgent: new CreateAgent(organizations, agents, draftAgentInstructions, ids, clock),
      draftAgentInstructions,
      listSkills: new ListSkills(skillCatalog),
      updateAgent: new UpdateAgent(agents, clock),
      deleteAgent: new DeleteAgent(agents, projects, tasks, clock),
      listAgents: new ListAgents(organizations, agents),
      getAgent: new GetAgent(agents),
      ...createAgentTransferUseCases(organizations, agents, ids, clock),
      setAgentCollaborators: new SetAgentCollaborators(agents, clock),
      createProject: new CreateProject(
        organizations,
        projects,
        agents,
        new FileSystemWorkspaceProvisioner(),
        ids,
        clock,
      ),
      listProjects: new ListProjects(organizations, projects),
      getProject: new GetProject(projects),
      ...createProjectMemberAndArchiveUseCases(projects, agents, tasks, clock),
      assignTask: new AssignTask({ projects, agents, tasks, recorder, launcher, queue, ids, clock }),
      sendFollowUp: new SendFollowUp(projects, tasks, recorder, launcher),
      cancelTask: new CancelTask(tasks, running, recorder, clock, queue),
      updateTask: new UpdateTask(tasks, agents, projects, recorder),
      startTask: new StartTask(projects, tasks, launcher, queue),
      enqueueTask: new EnqueueTask(projects, tasks, recorder, queue),
      dequeueTask: new DequeueTask(tasks, recorder, queue),
      reorderQueue: new ReorderQueue(projects, queue),
      getTask: new GetTask(tasks),
      getTaskTree: new GetTaskTree(projects, tasks, runs),
      getUsageDashboard: new GetUsageDashboard(organizations, tasks, runs, agents, projects, clock),
      getTaskConversation: new GetTaskConversation(tasks, conversations),
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
