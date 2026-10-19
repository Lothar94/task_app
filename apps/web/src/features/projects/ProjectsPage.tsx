import { useState } from 'react';
import { Activity, Check, Coins, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Dialog } from '../../components/Dialog';
import { StatTile } from '../../components/StatTile';
import { Tabs, tabPanelProps } from '../../components/Tabs';
import { Badge, Button, EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/ui';
import { formatCost, formatInteger, formatTokens } from '../../lib/format';
import type { AgentDto, ProjectDto } from '@fleet/shared';
import { useAgents } from '../agents/agentQueries';
import { useCurrentOrganization } from '../organizations/OrganizationContext';
import { type ProjectFilter, groupProjects, memberNames, summarizeProjects } from './projectListModel';
import { portfolioTelemetry, type ProjectTelemetry } from './projectTelemetryModel';
import { useCreateProject, useProjects } from './projectQueries';
import { ProjectForm } from './ProjectForm';
import { ProjectTable } from './ProjectTable';
import { type ProjectTelemetryState, useProjectTelemetry } from './useProjectTelemetry';

const MAX_SWARM_NAMES = 4;

const EMPTY_MESSAGES: Record<ProjectFilter, string> = {
  active: 'No hay proyectos activos. Crea uno con «Nuevo proyecto».',
  archived: 'No hay proyectos archivados.',
};

function ProjectTiles({
  projects,
  agents,
  telemetry,
}: {
  projects: ProjectDto[];
  agents: AgentDto[];
  telemetry: Map<string, ProjectTelemetryState>;
}) {
  const summary = summarizeProjects(projects);
  const activeTelemetry = projects.map((project) => telemetry.get(project.id));
  const settled = activeTelemetry.every((state) => state && !state.isPending);
  const portfolio = portfolioTelemetry(
    activeTelemetry.flatMap((state) => state?.telemetry ?? []) as ProjectTelemetry[],
  );
  const swarmNames = [...new Set(projects.flatMap((project) => memberNames(project, agents)))];
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="Proyectos activos" value={summary.activeProjects} icon={<Check />} tone="good" />
      <StatTile
        label="Tareas en curso"
        value={settled ? formatInteger(portfolio.activeTasks) : '…'}
        detail={
          settled &&
          `${formatInteger(portfolio.totalTasks)} totales (${formatInteger(portfolio.completedTasks)} completadas)`
        }
        icon={<Activity />}
      />
      <StatTile
        label="Agentes en el enjambre"
        value={summary.teamAgents}
        detail={
          swarmNames.length > 0 &&
          `${swarmNames.slice(0, MAX_SWARM_NAMES).join(', ')}${swarmNames.length > MAX_SWARM_NAMES ? '…' : ''}`
        }
        icon={<Users />}
      />
      <StatTile
        label="Consumo de tokens"
        value={settled ? formatTokens(portfolio.tokens) : '…'}
        detail={settled && `~${formatCost(portfolio.costUsd)} USD`}
        icon={<Coins />}
      />
    </div>
  );
}

export function ProjectsPage() {
  const projects = useProjects();
  const agents = useAgents();
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const organization = useCurrentOrganization();
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<ProjectFilter>('active');
  const telemetry = useProjectTelemetry(projects.data ?? []);

  if (projects.isPending || agents.isPending) return <Loading />;
  if (projects.error || agents.error) return <ErrorMessage error={projects.error ?? agents.error} />;

  const groups = groupProjects(projects.data);
  const visible = groups[filter];
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
      <ProjectTiles projects={groups.active} agents={agents.data} telemetry={telemetry} />
      <div className="mb-4">
        <Tabs
          label="Filtrar proyectos"
          idPrefix="projects"
          options={options}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <div {...tabPanelProps('projects', filter)}>
        {visible.length === 0 ? (
          <EmptyState>{EMPTY_MESSAGES[filter]}</EmptyState>
        ) : (
          <ProjectTable projects={visible} agents={agents.data} telemetry={telemetry} />
        )}
      </div>
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
