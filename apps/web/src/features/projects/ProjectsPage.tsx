import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { Tabs, tabPanelProps } from '../../components/Tabs';
import { Badge, Button, EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/ui';
import type { ProjectDto } from '@fleet/shared';
import { useProjectsLiveTelemetry } from '../../hooks/useProjectsLiveTelemetry';
import { useAgents } from '../agents/agentQueries';
import { useCurrentOrganization } from '../organizations/OrganizationContext';
import {
  type ProjectFilter,
  type ProjectSort,
  filterProjects,
  groupProjects,
  sortProjects,
} from './projectListModel';
import { useCreateProject, useProjects, useProjectsTelemetry } from './projectQueries';
import { ProjectForm } from './ProjectForm';
import { ProjectListControls } from './ProjectListControls';
import { ProjectTable } from './ProjectTable';
import { ProjectTiles } from './ProjectTiles';
import { ResumeProjectDialog } from './ResumeProjectDialog';

const EMPTY_MESSAGES: Record<ProjectFilter, string> = {
  active: 'No hay proyectos activos. Crea uno con «Nuevo proyecto».',
  archived: 'No hay proyectos archivados.',
  alerts: 'Ningún proyecto tiene alertas pendientes.',
};

export function ProjectsPage() {
  const projects = useProjects();
  const agents = useAgents();
  const telemetryQuery = useProjectsTelemetry();
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const organization = useCurrentOrganization();
  const [isCreating, setIsCreating] = useState(false);
  const [resuming, setResuming] = useState<ProjectDto | null>(null);
  const [filter, setFilter] = useState<ProjectFilter>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ProjectSort>('recent');
  const projectIds = useMemo(() => projects.data?.map((project) => project.id) ?? [], [projects.data]);
  const telemetry = useMemo(
    () => new Map(telemetryQuery.data?.projects.map((item) => [item.projectId, item])),
    [telemetryQuery.data],
  );
  useProjectsLiveTelemetry(organization.id, projectIds);

  if (projects.isPending || agents.isPending) return <Loading />;
  if (projects.error || agents.error) return <ErrorMessage error={projects.error ?? agents.error} />;

  const groups = groupProjects(projects.data, telemetry);
  const visible = sortProjects(filterProjects(groups[filter], query), sort, telemetry);
  const options = [
    { value: 'active' as const, label: 'Activos', count: groups.active.length },
    { value: 'archived' as const, label: 'Archivados', count: groups.archived.length },
    { value: 'alerts' as const, label: 'Con alertas', count: groups.alerts.length },
  ];
  const emptyMessage =
    groups[filter].length === 0 ? EMPTY_MESSAGES[filter] : `Ningún proyecto coincide con «${query.trim()}».`;

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
      <ProjectTiles
        summary={telemetryQuery.data?.summary}
        activeProjects={groups.active.length}
        agents={agents.data}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Filtrar proyectos"
          idPrefix="projects"
          options={options}
          value={filter}
          onChange={setFilter}
        />
        <ProjectListControls query={query} onQueryChange={setQuery} sort={sort} onSortChange={setSort} />
      </div>
      {telemetryQuery.error && (
        <div className="mb-4">
          <ErrorMessage
            error={new Error(`No se pudo cargar la telemetría: ${telemetryQuery.error.message}`)}
          />
        </div>
      )}
      <div {...tabPanelProps('projects', filter)}>
        {visible.length === 0 ? (
          <EmptyState>{emptyMessage}</EmptyState>
        ) : (
          <ProjectTable
            projects={visible}
            agents={agents.data}
            telemetry={telemetry}
            loading={telemetryQuery.isPending}
            onResume={setResuming}
          />
        )}
      </div>
      {resuming && (
        <ResumeProjectDialog
          key={resuming.id}
          projectId={resuming.id}
          projectName={resuming.name}
          alerts={telemetry.get(resuming.id)?.alerts ?? []}
          onClose={() => setResuming(null)}
        />
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
