import { useState } from 'react';
import { Check, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { StatTile } from '../../components/StatTile';
import {
  Badge,
  Button,
  EmptyState,
  ErrorMessage,
  Loading,
  PageHeader,
  SegmentedControl,
} from '../../components/ui';
import { useAgents } from '../agents/agentQueries';
import { useCurrentOrganization } from '../organizations/OrganizationContext';
import { type ProjectFilter, groupProjects, summarizeProjects } from './projectListModel';
import { useCreateProject, useProjects } from './projectQueries';
import { ProjectForm } from './ProjectForm';
import { ProjectTable } from './ProjectTable';

const EMPTY_MESSAGES: Record<ProjectFilter, string> = {
  active: 'No hay proyectos activos. Crea uno con «Nuevo proyecto».',
  archived: 'No hay proyectos archivados.',
};

export function ProjectsPage() {
  const projects = useProjects();
  const agents = useAgents();
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const organization = useCurrentOrganization();
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<ProjectFilter>('active');

  if (projects.isPending || agents.isPending) return <Loading />;
  if (projects.error || agents.error) return <ErrorMessage error={projects.error ?? agents.error} />;

  const groups = groupProjects(projects.data);
  const visible = groups[filter];
  const summary = summarizeProjects(groups.active);
  const options = [
    { value: 'active' as const, label: 'Activos', count: groups.active.length },
    { value: 'archived' as const, label: 'Archivados', count: groups.archived.length },
  ];

  return (
    <>
      <PageHeader
        title="Proyectos"
        breadcrumb={`${organization.name} / Repositorios y workflows`}
        badge={<Badge>{projects.data.length} en total</Badge>}
        subtitle="Cada proyecto tiene una carpeta de trabajo y un equipo de agentes."
        actions={
          <Button onClick={() => setIsCreating(true)}>
            <Plus aria-hidden className="size-4" />
            Nuevo proyecto
          </Button>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatTile label="Proyectos activos" value={summary.activeProjects} icon={<Check />} tone="good" />
        <StatTile label="Agentes en equipos" value={summary.teamAgents} icon={<Users />} />
      </div>
      <div className="mb-4">
        <SegmentedControl label="Filtrar proyectos" options={options} value={filter} onChange={setFilter} />
      </div>
      {visible.length === 0 ? (
        <EmptyState>{EMPTY_MESSAGES[filter]}</EmptyState>
      ) : (
        <ProjectTable projects={visible} agents={agents.data} />
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
