import type { AgentDto, ProjectDto } from '@fleet/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { Button, Card, ErrorMessage, Loading, PageHeader } from '../../components/ui';
import { useFleetEvents } from '../../hooks/useFleetEvents';
import { useAgents } from '../agents/agentQueries';
import { AgentGraph } from '../agents/diagram/AgentGraph';
import { AssignTaskForm } from '../tasks/AssignTaskForm';
import { QueueCard } from '../tasks/QueueCard';
import { TaskList } from '../tasks/TaskList';
import { useTaskTree } from '../tasks/taskQueries';
import { existingMilestones, existingTags, queuedTasks } from '../tasks/taskListModel';
import { collectActiveAgentIds } from '../tasks/taskTreeModel';
import { ProjectMembers } from './ProjectMembers';
import { useProject } from './projectQueries';
import { ProjectStats } from './ProjectStats';

function ProjectTasks({ projectId, agents }: { projectId: string; agents: AgentDto[] }) {
  const tree = useTaskTree(projectId);
  if (tree.isPending) return <Loading />;
  if (tree.error) return <ErrorMessage error={tree.error} />;
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
  const queued = queuedTasks(tree.data);
  return (
    <div className="space-y-6">
      <ProjectStats nodes={tree.data} />
      {queued.length > 0 && <QueueCard projectId={projectId} queued={queued} agentNames={agentNames} />}
      <Card title="Tareas">
        <TaskList projectId={projectId} roots={tree.data} agentNames={agentNames} />
      </Card>
    </div>
  );
}

function ProjectTeam({
  project,
  agents,
  members,
}: {
  project: ProjectDto;
  agents: AgentDto[];
  members: AgentDto[];
}) {
  const tree = useTaskTree(project.id);
  const navigate = useNavigate();
  return (
    <details className="group rounded-lg border border-zinc-800 bg-zinc-900/40">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-zinc-300">Equipo · {members.length} agente(s)</span>
        <span className="text-xs text-zinc-500 group-open:hidden">Mostrar</span>
        <span className="hidden text-xs text-zinc-500 group-open:inline">Ocultar</span>
      </summary>
      <div className="grid gap-6 border-t border-zinc-800 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <AgentGraph
          agents={members}
          highlightedIds={collectActiveAgentIds(tree.data ?? [])}
          onSelect={(id) => navigate(`/agents/${id}`)}
        />
        <ProjectMembers project={project} agents={agents} />
      </div>
    </details>
  );
}

function ProjectView({ project, agents }: { project: ProjectDto; agents: AgentDto[] }) {
  const [isAssigning, setIsAssigning] = useState(false);
  const members = agents.filter((agent) => project.memberIds.includes(agent.id));
  const tree = useTaskTree(project.id);
  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={
          <>
            {project.description && <span className="block">{project.description}</span>}
            <code className="text-xs text-zinc-500">{project.workspacePath}</code>
          </>
        }
        actions={<Button onClick={() => setIsAssigning(true)}>+ Nueva tarea</Button>}
      />
      <div className="space-y-6">
        <ProjectTasks projectId={project.id} agents={agents} />
        <ProjectTeam project={project} agents={agents} members={members} />
      </div>
      <Dialog open={isAssigning} title="Nueva tarea" onClose={() => setIsAssigning(false)}>
        <AssignTaskForm
          projectId={project.id}
          members={members}
          milestones={existingMilestones(tree.data ?? [])}
          tags={existingTags(tree.data ?? [])}
          onAssigned={() => setIsAssigning(false)}
        />
      </Dialog>
    </>
  );
}

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);
  const agents = useAgents();
  useFleetEvents(projectId);

  if (project.isPending || agents.isPending) return <Loading />;
  if (project.error || agents.error) return <ErrorMessage error={project.error ?? agents.error} />;
  return <ProjectView project={project.data} agents={agents.data} />;
}
