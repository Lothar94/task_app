import type { AgentDto, ProjectDto } from '@fleet/shared';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { ErrorMessage, FOCUS_RING, Loading } from '../../components/ui';
import { useFleetEvents } from '../../hooks/useFleetEvents';
import { useNow } from '../../hooks/useNow';
import { formatTokens } from '../../lib/format';
import { useTaskTree } from '../tasks/taskQueries';
import { collectActiveAgentIds, countTasks, treeTotals } from '../tasks/taskTreeModel';
import { ExecutionStack } from './ExecutionStack';
import { INSPECTION_PANEL_ID, findOrchestrator, recentRoots, tokensPerMinute } from './inspectionModel';
import { SwarmTopology } from './SwarmTopology';

const TITLE_ID = `${INSPECTION_PANEL_ID}-title`;

// "Salud del clúster" is intentionally absent: the API exposes no such data.
export function ProjectInspection({ project, agents }: { project: ProjectDto; agents: AgentDto[] }) {
  const tree = useTaskTree(project.id);
  useFleetEvents(project.id);
  const navigate = useNavigate();
  const nodes = tree.data;
  const workingIds = useMemo(() => collectActiveAgentIds(nodes ?? []), [nodes]);
  const members = useMemo(
    () => agents.filter((agent) => project.memberIds.includes(agent.id)),
    [agents, project.memberIds],
  );
  const now = useNow(workingIds.size > 0);

  const orchestrator = nodes ? findOrchestrator(members, nodes) : null;
  const roots = nodes ? recentRoots(nodes) : [];
  const perMinute = nodes ? tokensPerMinute(treeTotals(nodes)) : null;

  return (
    <section id={INSPECTION_PANEL_ID} aria-labelledby={TITLE_ID} className="mt-8 space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={TITLE_ID} tabIndex={-1} className="text-lg font-semibold text-fg outline-none">
          Inspección activa: {project.name}
        </h2>
        {orchestrator && <p className="font-mono text-xs text-fg-muted">Nodo maestro: {orchestrator.name}</p>}
      </header>
      {tree.isPending && <Loading />}
      {tree.error && <ErrorMessage error={tree.error} />}
      {nodes && (
        <>
          <div className="space-y-2">
            <h3 className="label-mono text-fg-subtle">Pila de ejecución reciente</h3>
            <ExecutionStack projectId={project.id} roots={roots} agents={agents} now={now} />
            <p className="flex flex-wrap justify-between gap-2 font-mono text-xs text-fg-muted">
              <span>
                Mostrando las {roots.length} tareas más recientes de {countTasks(nodes).total}
              </span>
              <Link to={`/projects/${project.id}`} className={`text-accent hover:underline ${FOCUS_RING}`}>
                Abrir vista completa de tareas
              </Link>
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="label-mono text-fg-subtle">Topología del enjambre ({members.length} agentes)</h3>
            <SwarmTopology
              members={members}
              orchestratorId={orchestrator?.id ?? null}
              workingIds={workingIds}
              onSelectAgent={(agentId) => navigate(`/agents/${agentId}`)}
            />
          </div>
          {perMinute !== null && (
            <p
              className="font-mono text-xs text-fg-muted"
              title="Media sobre el tiempo de trabajo de los agentes"
            >
              Tokens por minuto: ~{formatTokens(perMinute)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
