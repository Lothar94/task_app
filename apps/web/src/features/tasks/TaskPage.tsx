import { type TaskDto, isArchivedProject } from '@fleet/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { Button, Card, ErrorMessage, Loading, PageHeader } from '../../components/ui';
import { useFleetEvents } from '../../hooks/useFleetEvents';
import { useAgents } from '../agents/agentQueries';
import { useSyncOrganization } from '../organizations/OrganizationContext';
import { ConversationView } from './ConversationView';
import { ResultPanel } from './ResultPanel';
import { TaskNumber, taskLabel } from './taskLabel';
import { FollowUpForm } from './FollowUpForm';
import { TaskTree } from './TaskTree';
import { findNode, subtreeMetrics } from './taskTreeModel';
import { formatCost, formatDuration, formatTokens } from '../../lib/format';
import { TaskEditForm } from './TaskEditForm';
import { TaskLabels } from './TaskLabels';
import { existingMilestones, existingTags } from './taskListModel';
import {
  useCancelTask,
  useConversation,
  useDequeueTask,
  useEnqueueTask,
  useStartTask,
  useTask,
  useTaskTree,
} from './taskQueries';
import { isTaskActive, isTaskPlanned, TaskStatusBadge } from './TaskStatusBadge';
import { useProject } from '../projects/projectQueries';

function TaskMetricsSummary({ task }: { task: TaskDto }) {
  const tree = useTaskTree(task.projectId);
  const node = tree.data ? findNode(tree.data, task.id) : undefined;
  if (!node || node.metrics.runs === 0) return null;
  const total = subtreeMetrics(node);
  const delegated = node.children.length > 0 ? ` (${formatTokens(total.totalTokens)} con subtareas)` : '';
  return (
    <span className="text-zinc-500" title={`Coste estimado ${formatCost(total.costUsd)}`}>
      · {formatDuration(node.metrics.durationMs)} trabajando · {formatTokens(node.metrics.totalTokens)} tokens
      {delegated} · {node.metrics.runs} ejecución{node.metrics.runs === 1 ? '' : 'es'}
    </span>
  );
}

function TaskMeta({ task, agentName }: { task: TaskDto; agentName: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <TaskNumber number={task.number} />
      <TaskStatusBadge status={task.status} />
      <span>
        Responsable:{' '}
        <Link to={`/agents/${task.agentId}`} className="text-indigo-300 hover:underline">
          {agentName}
        </Link>
      </span>
      {task.startedAt && (
        <span className="text-zinc-500">· inicio {new Date(task.startedAt).toLocaleString()}</span>
      )}
      <TaskMetricsSummary task={task} />
      <TaskLabels milestone={task.milestone} tags={task.tags} />
    </span>
  );
}

function ConversationPanel({ taskId, projectId }: { taskId: string; projectId: string }) {
  const conversation = useConversation(taskId);
  if (conversation.isPending) return <Loading />;
  if (conversation.error) return <ErrorMessage error={conversation.error} />;
  return <ConversationView messages={conversation.data} projectId={projectId} />;
}

function SubtasksPanel({ task, agentNames }: { task: TaskDto; agentNames: Map<string, string> }) {
  const tree = useTaskTree(task.projectId);
  const subtasks = tree.data ? (findNode(tree.data, task.id)?.children ?? []) : [];
  return (
    <Card title="Subtareas delegadas">
      {subtasks.length === 0 ? (
        <p className="text-sm text-zinc-500">Ninguna.</p>
      ) : (
        <TaskTree projectId={task.projectId} nodes={subtasks} agentNames={agentNames} compact />
      )}
    </Card>
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
    <span role="alert" className="self-center text-sm text-red-300">
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

function ParentTaskLink({ projectId, parentTaskId }: { projectId: string; parentTaskId: string }) {
  const parent = useTask(parentTaskId);
  return (
    <Link to={`/projects/${projectId}/tasks/${parentTaskId}`} className="hover:text-zinc-300">
      · Delegada desde{' '}
      {parent.data ? `${taskLabel(parent.data.number)}: ${parent.data.title}` : 'la tarea padre'}
    </Link>
  );
}

function Breadcrumbs({ task }: { task: TaskDto }) {
  return (
    <nav className="mb-3 flex gap-2 text-sm text-zinc-500">
      <Link to={`/projects/${task.projectId}`} className="hover:text-zinc-300">
        ← Proyecto
      </Link>
      {task.parentTaskId && <ParentTaskLink projectId={task.projectId} parentTaskId={task.parentTaskId} />}
    </nav>
  );
}

function TaskView({
  task,
  agentNames,
  isReadOnly,
}: {
  task: TaskDto;
  agentNames: Map<string, string>;
  isReadOnly: boolean;
}) {
  const isActive = isTaskActive(task.status);
  const isRoot = task.parentTaskId === null;
  const [isEditing, setIsEditing] = useState(false);
  return (
    <>
      <Breadcrumbs task={task} />
      <PageHeader
        title={task.title}
        subtitle={<TaskMeta task={task} agentName={agentNames.get(task.agentId) ?? '?'} />}
        actions={
          <TaskActions
            task={task}
            isReadOnly={isReadOnly}
            onEdit={isRoot && !isReadOnly ? () => setIsEditing(true) : undefined}
          />
        }
      />
      <div className="space-y-6">
        {task.resultSummary && <ResultPanel key={task.resultSummary} task={task} />}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-4">
            <Card title="Conversación">
              <ConversationPanel taskId={task.id} projectId={task.projectId} />
            </Card>
            {!isReadOnly && !isActive && !isTaskPlanned(task.status) && (
              <Card title="Continuar la conversación">
                <FollowUpForm taskId={task.id} />
              </Card>
            )}
          </div>
          <aside className="min-w-0 xl:sticky xl:top-4">
            <SubtasksPanel task={task} agentNames={agentNames} />
          </aside>
        </div>
      </div>
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
      isReadOnly={isArchivedProject(project.data)}
      agentNames={new Map(agents.data.map((agent) => [agent.id, agent.name]))}
    />
  );
}
