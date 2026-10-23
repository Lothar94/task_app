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
import { SetAgentEnabled } from '../application/agents/SetAgentEnabled.js';
import { UpdateAgent } from '../application/agents/UpdateAgent.js';
import type { AgentRuntime } from '../application/ports/AgentRuntime.js';
import type { EventPublisher, EventSubscriber } from '../application/ports/EventBus.js';
import type { InstructionWriter } from '../application/ports/InstructionWriter.js';
import type { McpServerCatalog } from '../application/ports/McpServerCatalog.js';
import type { SkillCatalog } from '../application/ports/SkillCatalog.js';
import type { SkillWorkspace } from '../application/ports/SkillWorkspace.js';
import { ListSkills } from '../application/skills/ListSkills.js';
import type { Logger } from '../application/ports/Logger.js';
import { AgentActivityNotifier } from '../application/fleet/AgentActivityNotifier.js';
import { GetAgentActivity } from '../application/fleet/GetAgentActivity.js';
import { GetFleetStatus } from '../application/fleet/GetFleetStatus.js';
import { GetAgentRuntimeInfo } from '../application/runtime/GetAgentRuntimeInfo.js';
import { SearchOrganization } from '../application/search/SearchOrganization.js';
import { ResolveProjectOrganization } from '../application/projects/ResolveProjectOrganization.js';
import { GetProjectsTelemetry } from '../application/projects/GetProjectsTelemetry.js';
import { ResumeProject } from '../application/projects/ResumeProject.js';
import { GetUsageDashboard } from '../application/metrics/GetUsageDashboard.js';
import { ModelPriceTable, type ModelPriceEntry } from '../application/metrics/ModelPriceTable.js';
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
import { RetryTask } from '../application/tasks/RetryTask.js';
import { StartTask } from '../application/tasks/StartTask.js';
import { TaskQueue } from '../application/tasks/TaskQueue.js';
import { UpdateTask } from '../application/tasks/UpdateTask.js';
import { RecoverInterruptedTasks } from '../application/tasks/RecoverInterruptedTasks.js';
import { GetTaskExecution } from '../application/metrics/GetTaskExecution.js';
import { GitScopeResolver } from '../application/tasks/GitScope.js';
import { GetTaskGitContext, GetTaskGitDiff } from '../application/tasks/QueryTaskGit.js';
import { TaskGitTracker } from '../application/tasks/TaskGitTracker.js';
import type { GitWorkspace } from '../application/ports/GitWorkspace.js';
import { SqliteTaskGitSnapshotRepository } from '../infrastructure/persistence/sqlite/SqliteTaskGitSnapshotRepository.js';
import { GitCliWorkspace } from '../infrastructure/system/GitCliWorkspace.js';
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
  /** Read-only git access to workspaces; defaults to the git CLI. */
  git?: GitWorkspace;
  maxDelegationDepth: number;
  /** Version of the app, shown by the fleet status. */
  appVersion: string;
  reservedPorts?: number[];
  /** Price table of the usage dashboard; defaults to the built-in estimates. */
  modelPrices?: readonly ModelPriceEntry[];
  /** MCP servers agents may be given; defaults to none. */
  mcpServerCatalog?: McpServerCatalog;
  /** Window in which task changes collapse into one `agent.activity` event per organization. */
  agentActivityCoalesceMs?: number;
}

const EMPTY_MCP_CATALOG: McpServerCatalog = { list: async () => [] };

interface Infrastructure {
  ids: UuidGenerator;
  clock: SystemClock;
  agents: SqliteAgentRepository;
  projects: SqliteProjectRepository;
  tasks: SqliteTaskRepository;
  recorder: TaskRecorder;
  gitTracker: TaskGitTracker;
}

/** Wires the execution of tasks: running agents, delegation and cancellation. */
function createTaskExecution(
  { ids, clock, agents, projects, tasks, recorder, gitTracker }: Infrastructure,
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
    gitTracker,
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
  { ids, clock, runtime }: { ids: UuidGenerator; clock: SystemClock; runtime: AgentRuntime },
) {
  return {
    exportAgents: new ExportAgents(organizations, agents, clock),
    importAgents: new ImportAgents(organizations, agents, runtime, ids, clock),
  };
}

/** Wires the edition of an agent sheet: profile, collaborators, enabled state and runtime support. */
function createAgentSettingsUseCases(
  agents: SqliteAgentRepository,
  clock: SystemClock,
  { runtime, mcpServerCatalog = EMPTY_MCP_CATALOG }: ContainerOptions,
) {
  return {
    updateAgent: new UpdateAgent(agents, runtime, clock),
    setAgentCollaborators: new SetAgentCollaborators(agents, clock),
    setAgentEnabled: new SetAgentEnabled(agents, clock),
    getAgentRuntimeInfo: new GetAgentRuntimeInfo(runtime, mcpServerCatalog),
  };
}

interface ActivitySources {
  organizations: SqliteOrganizationRepository;
  projects: SqliteProjectRepository;
  tasks: SqliteTaskRepository;
  agents: SqliteAgentRepository;
  clock: SystemClock;
  events: EventPublisher & EventSubscriber;
}

/** Wires the live activity of the org chart and its coalesced `agent.activity` events. */
function createAgentActivity(
  { organizations, projects, tasks, agents, clock, events }: ActivitySources,
  { logger, agentActivityCoalesceMs }: ContainerOptions,
) {
  const getAgentActivity = new GetAgentActivity(organizations, projects, tasks, agents, clock);
  new AgentActivityNotifier(projects, getAgentActivity, events, logger, agentActivityCoalesceMs).watch(
    events,
  );
  return { getAgentActivity };
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

/** Wires task telemetry: execution metrics plus the read-only git context (snapshots and queries). */
function createTelemetrySupport(
  { db, logger, git = new GitCliWorkspace() }: ContainerOptions,
  tasks: SqliteTaskRepository,
  projects: SqliteProjectRepository,
  runs: SqliteTaskRunRepository,
) {
  const snapshots = new SqliteTaskGitSnapshotRepository(db);
  const scopes = new GitScopeResolver(tasks, projects, snapshots, git);
  return {
    gitTracker: new TaskGitTracker(git, snapshots, logger),
    telemetryUseCases: {
      getTaskExecution: new GetTaskExecution(tasks, runs),
      getTaskGitContext: new GetTaskGitContext(scopes, git),
      getTaskGitDiff: new GetTaskGitDiff(scopes, git),
    },
  };
}

interface UsageSources {
  organizations: SqliteOrganizationRepository;
  tasks: SqliteTaskRepository;
  runs: SqliteTaskRunRepository;
  agents: SqliteAgentRepository;
  projects: SqliteProjectRepository;
  clock: SystemClock;
}

/** Wires the read-only usage views: project telemetry and the dashboard with its price table. */
function createUsageUseCases(
  { organizations, tasks, runs, agents, projects, clock }: UsageSources,
  { modelPrices }: ContainerOptions,
) {
  return {
    getProjectsTelemetry: new GetProjectsTelemetry(organizations, tasks, runs, agents, projects, clock),
    getUsageDashboard: new GetUsageDashboard(
      organizations,
      tasks,
      runs,
      agents,
      projects,
      clock,
      new ModelPriceTable(modelPrices),
    ),
  };
}

/** Composition root: the only place that knows every concrete implementation. */
export function createContainer(options: ContainerOptions) {
  const { db, instructionWriter, skillCatalog, runtime } = options;
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
  const { gitTracker, telemetryUseCases } = createTelemetrySupport(options, tasks, projects, runs);
  const { running, launcher } = createTaskExecution(
    { ids, clock, agents, projects, tasks, recorder, gitTracker },
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
      createAgent: new CreateAgent(organizations, agents, draftAgentInstructions, runtime, ids, clock),
      draftAgentInstructions,
      listSkills: new ListSkills(skillCatalog),
      deleteAgent: new DeleteAgent(agents, projects, tasks, clock),
      listAgents: new ListAgents(organizations, agents),
      getAgent: new GetAgent(agents),
      ...createAgentTransferUseCases(organizations, agents, { ids, clock, runtime }),
      ...createAgentSettingsUseCases(agents, clock, options),
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
      retryTask: new RetryTask(projects, tasks, recorder, queue),
      reorderQueue: new ReorderQueue(projects, queue),
      getTask: new GetTask(tasks),
      getTaskTree: new GetTaskTree(projects, tasks, runs),
      resumeProject: new ResumeProject(projects, tasks, recorder, queue),
      ...createUsageUseCases({ organizations, tasks, runs, agents, projects, clock }, options),
      searchOrganization: new SearchOrganization(organizations, projects, tasks, agents),
      getFleetStatus: new GetFleetStatus(organizations, projects, tasks, agents, clock, options.appVersion),
      ...createAgentActivity({ organizations, projects, tasks, agents, clock, events }, options),
      resolveProjectOrganization: new ResolveProjectOrganization(projects),
      ...telemetryUseCases,
      getTaskConversation: new GetTaskConversation(tasks, conversations),
    },
  };
}

export type Container = ReturnType<typeof createContainer>;
