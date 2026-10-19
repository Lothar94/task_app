import { type TaskDto, isArchivedProject } from '@fleet/shared';
import { type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { Button, ErrorMessage, Loading } from '../../components/ui';
import { useFleetEvents } from '../../hooks/useFleetEvents';
import { useAgents } from '../agents/agentQueries';
import { useSyncOrganization } from '../organizations/OrganizationContext';
import { TaskNumber, taskLabel } from './taskLabel';
import { findNode, subtreeMetrics } from './taskTreeModel';
import { formatCost, formatDuration, formatTokens } from '../../lib/format';
import { TaskWorkspace } from './TaskWorkspace';
import { TaskEditForm } from './TaskEditForm';
import { TaskLabels } from './TaskLabels';
import { existingMilestones, existingTags } from './taskListModel';
import {
  useCancelTask,
  useDequeueTask,
  useEnqueueTask,
  useStartTask,
  useTask,
  useTaskTree,
} from './taskQueries';
import { ProposalNote } from './ProposalNote';
import { isTaskActive, isTaskPlanned, TaskStatusBadge } from './TaskStatusBadge';
import { useProject } from '../projects/projectQueries';

const META_ITEM = 'flex items-baseline gap-1.5';
const META_KEY = 'text-fg-subtle';

function TaskMetricsSummary({ task }: { task: TaskDto }) {
  const tree = useTaskTree(task.projectId);
  const node = tree.data ? findNode(tree.data, task.id) : undefined;
  if (!node || node.metrics.runs === 0) return null;
  const total = subtreeMetrics(node);
  const delegated = node.children.length > 0 ? ` (${formatTokens(total.totalTokens)} con subtareas)` : '';
  return (
    <>
      <span className={META_ITEM}>
        <span className={META_KEY}>Duración:</span>
        {formatDuration(node.metrics.durationMs)}
      </span>
      <span className={META_ITEM} title={`Coste estimado ${formatCost(total.costUsd)}`}>
        <span className={META_KEY}>Tokens:</span>
        {formatTokens(node.metrics.totalTokens)}
        {delegated}
      </span>
      <span className={META_ITEM}>
        <span className={META_KEY}>Ejecuciones:</span>
        {node.metrics.runs}
      </span>
    </>
  );
}

function TaskMeta({
  task,
  agentName,
  agentNames,
}: {
  task: TaskDto;
  agentName: string;
  agentNames: Map<string, string>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-fg-muted">
        <span className={META_ITEM}>
          <span className={META_KEY}>Responsable:</span>
          <Link to={`/agents/${task.agentId}`} className="text-accent hover:underline">
            {agentName}
          </Link>
        </span>
        {task.startedAt && (
          <span className={META_ITEM}>
            <span className={META_KEY}>Inicio:</span>
            {new Date(task.startedAt).toLocaleString()}
          </span>
        )}
        <TaskMetricsSummary task={task} />
      </div>
      <ProposalNote task={task} agentNames={agentNames} detailed />
      <TaskLabels milestone={task.milestone} tags={task.tags} />
    </div>
  );
}

function PlannedActions({ task }: { task: TaskDto }) {
  const start = useStartTask();
  const enqueue = useEnqueueTask();
  const dequeue = useDequeueTask();
  const queueAction = task.status === 'queued' ? dequeue : enqueue;
  const busy = start.isPending || queueAction.isPending;
  const error = start.error ?? enqueue.error ?? dequeue.error;
  return (
    <>
      <Button disabled={busy} onClick={() => start.mutate(task.id)}>
        Iniciar
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => queueAction.mutate(task.id)}>
        {task.status === 'queued' ? 'Quitar de la cola' : 'Encolar'}
      </Button>
      <ActionError error={error} />
    </>
  );
}

function CancelTaskButton({ taskId }: { taskId: string }) {
  const cancel = useCancelTask();
  return (
    <>
      <Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate(taskId)}>
        Cancelar tarea
      </Button>
      <ActionError error={cancel.error} />
    </>
  );
}

function ActionError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <span role="alert" className="self-center text-sm text-danger">
      {error instanceof Error ? error.message : String(error)}
    </span>
  );
}

function TaskActions({
  task,
  onEdit,
  isReadOnly,
}: {
  task: TaskDto;
  onEdit?: () => void;
  isReadOnly: boolean;
}) {
  const isPlanned = isTaskPlanned(task.status);
  return (
    <>
      {onEdit && (
        <Button variant="secondary" onClick={onEdit}>
          Editar
        </Button>
      )}
      {isPlanned && !isReadOnly && task.parentTaskId === null && <PlannedActions task={task} />}
      {(isPlanned || isTaskActive(task.status)) && <CancelTaskButton taskId={task.id} />}
    </>
  );
}

function EditTaskDialog({ task, onClose }: { task: TaskDto; onClose: () => void }) {
  const project = useProject(task.projectId);
  const agents = useAgents();
  const tree = useTaskTree(task.projectId);
  const members = (agents.data ?? []).filter((agent) => project.data?.memberIds.includes(agent.id));
  return (
    <TaskEditForm
      task={task}
      members={members}
      milestones={existingMilestones(tree.data ?? [])}
      tags={existingTags(tree.data ?? [])}
      canEditContent={isTaskPlanned(task.status)}
      onSaved={onClose}
    />
  );
}

function BreadcrumbSeparator() {
  return <span aria-hidden>/</span>;
}

function ParentTaskLink({ projectId, parentTaskId }: { projectId: string; parentTaskId: string }) {
  const parent = useTask(parentTaskId);
  return (
    <>
      <BreadcrumbSeparator />
      <Link to={`/projects/${projectId}/tasks/${parentTaskId}`} className="hover:text-fg">
        Delegada desde{' '}
        {parent.data ? `${taskLabel(parent.data.number)}: ${parent.data.title}` : 'la tarea padre'}
      </Link>
    </>
  );
}

function Breadcrumbs({ task, projectName }: { task: TaskDto; projectName: string }) {
  return (
    <nav aria-label="Ruta de navegación" className="label-mono-md mb-3 flex flex-wrap gap-2 text-fg-subtle">
      <Link to="/projects" className="hover:text-fg">
        ← Proyectos
      </Link>
      <BreadcrumbSeparator />
      <Link to={`/projects/${task.projectId}`} className="hover:text-fg">
        {projectName}
      </Link>
      {task.parentTaskId && <ParentTaskLink projectId={task.projectId} parentTaskId={task.parentTaskId} />}
      <BreadcrumbSeparator />
      <span aria-current="page" className="text-fg">
        {taskLabel(task.number)}
      </span>
    </nav>
  );
}

function TaskHeader({
  task,
  projectName,
  agentNames,
  actions,
}: {
  task: TaskDto;
  projectName: string;
  agentNames: Map<string, string>;
  actions: ReactNode;
}) {
  return (
    <header className="space-y-3">
      <Breadcrumbs task={task} projectName={projectName} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 shrink-0">
            <TaskNumber number={task.number} />
          </span>
          <h1 className="line-clamp-2 min-w-0 flex-1 text-lg leading-7 font-semibold tracking-tight [overflow-wrap:anywhere] md:text-xl">
            {task.title}
          </h1>
          <span className="mt-1 shrink-0">
            <TaskStatusBadge status={task.status} />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      <TaskMeta task={task} agentName={agentNames.get(task.agentId) ?? '?'} agentNames={agentNames} />
    </header>
  );
}

function TaskView({
  task,
  projectName,
  agentNames,
  isReadOnly,
}: {
  task: TaskDto;
  projectName: string;
  agentNames: Map<string, string>;
  isReadOnly: boolean;
}) {
  const isRoot = task.parentTaskId === null;
  const [isEditing, setIsEditing] = useState(false);
  return (
    <>
      <TaskWorkspace
        task={task}
        agentName={agentNames.get(task.agentId) ?? '?'}
        agentNames={agentNames}
        isReadOnly={isReadOnly}
        header={
          <TaskHeader
            task={task}
            projectName={projectName}
            agentNames={agentNames}
            actions={
              <TaskActions
                task={task}
                isReadOnly={isReadOnly}
                onEdit={isRoot && !isReadOnly ? () => setIsEditing(true) : undefined}
              />
            }
          />
        }
      />
      {isRoot && (
        <Dialog open={isEditing} title="Editar tarea" onClose={() => setIsEditing(false)}>
          <EditTaskDialog task={task} onClose={() => setIsEditing(false)} />
        </Dialog>
      )}
    </>
  );
}

export function TaskPage() {
  const { projectId = '', taskId = '' } = useParams();
  const task = useTask(taskId);
  const project = useProject(projectId);
  const isInOrganization = useSyncOrganization(project.data?.organizationId);
  const agents = useAgents();
  useFleetEvents(projectId);

  const failed = [task, project, agents].find((query) => query.error);
  if (failed) return <ErrorMessage error={failed.error} />;
  if (!task.data || !project.data || !agents.data || !isInOrganization) return <Loading />;
  return (
    <TaskView
      task={task.data}
      projectName={project.data.name}
      isReadOnly={isArchivedProject(project.data)}
      agentNames={new Map(agents.data.map((agent) => [agent.id, agent.name]))}
    />
  );
}
