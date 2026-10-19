import type { AgentDto, ProjectDto } from '@fleet/shared';
import { ArrowRight, Folder } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, FOCUS_RING } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { memberNames } from './projectListModel';

const MAX_TEAM_CHIPS = 4;
const COLUMN = 'label-mono px-4 py-2.5 text-left font-normal text-fg-subtle';

function TeamCell({ project, agents }: { project: ProjectDto; agents: AgentDto[] }) {
  const names = memberNames(project, agents);
  return (
    <>
      <p className="mb-1.5 font-mono text-xs text-fg-muted">
        {project.memberIds.length} {project.memberIds.length === 1 ? 'agente' : 'agentes'}
      </p>
      <ul className="flex flex-wrap gap-1" aria-label="Equipo">
        {names.slice(0, MAX_TEAM_CHIPS).map((name) => (
          <li key={name}>
            <Badge>{name}</Badge>
          </li>
        ))}
        {names.length > MAX_TEAM_CHIPS && (
          <li>
            <Badge>+{names.length - MAX_TEAM_CHIPS}</Badge>
          </li>
        )}
      </ul>
    </>
  );
}

function ProjectRow({ project, agents }: { project: ProjectDto; agents: AgentDto[] }) {
  const href = `/projects/${project.id}`;
  return (
    <tr className="block border-b border-line p-4 transition-colors last:border-b-0 hover:bg-surface-hover md:table-row md:p-0">
      <td className="block min-w-0 md:table-cell md:px-4 md:py-3.5 md:align-top">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`size-2 shrink-0 rounded-full ${project.archivedAt ? 'bg-fg-subtle' : 'bg-success'}`}
          />
          <Link
            to={href}
            className={`truncate text-base font-semibold text-fg hover:text-accent ${FOCUS_RING}`}
          >
            {project.name}
          </Link>
          {project.archivedAt && (
            <>
              <Badge>Archivado</Badge>
              <span className="font-mono text-xs whitespace-nowrap text-fg-subtle">
                {formatDate(project.archivedAt)}
              </span>
            </>
          )}
        </div>
        {project.description && (
          <p className="mt-1 line-clamp-1 text-sm text-fg-muted">{project.description}</p>
        )}
        <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-fg-subtle">
          <Folder aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{project.workspacePath}</span>
        </p>
      </td>
      <td className="mt-3 block md:mt-0 md:table-cell md:w-[22rem] md:px-4 md:py-3.5 md:align-top">
        <TeamCell project={project} agents={agents} />
      </td>
      <td className="mt-3 block md:mt-0 md:table-cell md:px-4 md:py-3.5 md:text-right md:align-top">
        <Link
          to={href}
          aria-label={`Abrir ${project.name}`}
          className={`inline-flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1 font-mono text-xs text-fg hover:border-fg-subtle hover:bg-fg/5 ${FOCUS_RING}`}
        >
          Abrir
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </td>
    </tr>
  );
}

export function ProjectTable({ projects, agents }: { projects: ProjectDto[]; agents: AgentDto[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <table className="block w-full md:table">
        <thead className="max-md:sr-only md:table-header-group">
          <tr className="border-b border-line bg-surface-raised/50">
            <th scope="col" className={COLUMN}>
              Proyecto &amp; workspace
            </th>
            <th scope="col" className={COLUMN}>
              Equipo de agentes
            </th>
            <th scope="col" className={`${COLUMN} text-right`}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} agents={agents} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
