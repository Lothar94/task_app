import type { ProjectDto } from '@fleet/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Dialog } from '../../components/Dialog';
import {
  Badge,
  Button,
  EmptyState,
  ErrorMessage,
  Loading,
  PageHeader,
  ROW_CLASS,
  RowList,
  SegmentedControl,
} from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useAgents } from '../agents/agentQueries';
import { type ProjectFilter, groupProjects } from './projectListModel';
import { useCreateProject, useProjects } from './projectQueries';
import { ProjectForm } from './ProjectForm';

const EMPTY_MESSAGES: Record<ProjectFilter, string> = {
  active: 'No hay proyectos activos. Crea uno con «Nuevo proyecto».',
  archived: 'No hay proyectos archivados.',
};

function ProjectRow({ project }: { project: ProjectDto }) {
  return (
    <li>
      <Link to={`/projects/${project.id}`} className={ROW_CLASS}>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="truncate font-semibold">{project.name}</span>
            {project.archivedAt && (
              <>
                <Badge>Archivado</Badge>
                <span className="text-xs whitespace-nowrap text-zinc-500">
                  {formatDate(project.archivedAt)}
                </span>
              </>
            )}
          </p>
          {project.description && <p className="line-clamp-1 text-sm text-zinc-400">{project.description}</p>}
        </div>
        <code className="hidden max-w-[40%] truncate font-mono text-xs text-zinc-500 md:block">
          {project.workspacePath}
        </code>
        <span className="text-xs whitespace-nowrap text-zinc-500">{project.memberIds.length} agente(s)</span>
      </Link>
    </li>
  );
}

export function ProjectsPage() {
  const projects = useProjects();
  const agents = useAgents();
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<ProjectFilter>('active');

  if (projects.isPending || agents.isPending) return <Loading />;
  if (projects.error || agents.error) return <ErrorMessage error={projects.error ?? agents.error} />;

  const groups = groupProjects(projects.data);
  const visible = groups[filter];
  const options = [
    { value: 'active' as const, label: `Activos (${groups.active.length})` },
    { value: 'archived' as const, label: `Archivados (${groups.archived.length})` },
  ];

  return (
    <>
      <PageHeader
        title="Proyectos"
        subtitle="Cada proyecto tiene una carpeta de trabajo y un equipo de agentes."
        actions={<Button onClick={() => setIsCreating(true)}>Nuevo proyecto</Button>}
      />
      <div className="mb-4">
        <SegmentedControl label="Filtrar proyectos" options={options} value={filter} onChange={setFilter} />
      </div>
      {visible.length === 0 ? (
        <EmptyState>{EMPTY_MESSAGES[filter]}</EmptyState>
      ) : (
        <RowList>
          {visible.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </RowList>
      )}
      <Dialog open={isCreating} title="Nuevo proyecto" onClose={() => setIsCreating(false)}>
        <ProjectForm
          agents={agents.data}
          isSubmitting={createProject.isPending}
          error={createProject.error}
          onSubmit={(input) =>
            createProject.mutate(input, { onSuccess: (project) => navigate(`/projects/${project.id}`) })
          }
        />
      </Dialog>
    </>
  );
}
