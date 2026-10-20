import type { TaskNodeDto } from '@fleet/shared';
import { StatTile } from '../../components/StatTile';
import { formatCost, formatDuration, formatTokens } from '../../lib/format';
import { countTasks, treeTotals } from '../tasks/taskTreeModel';

export function ProjectStats({ nodes }: { nodes: TaskNodeDto[] }) {
  const counts = countTasks(nodes);
  const { tokens, costUsd: cost, workingMs } = treeTotals(nodes);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
      <StatTile label="Tareas" value={counts.total} detail="incluidas subtareas" />
      <StatTile label="En curso" value={counts.active} tone="active" />
      <StatTile label="Planificadas" value={counts.planned} detail={`${counts.queued} en cola`} />
      <StatTile label="Completadas" value={counts.completed} tone="good" />
      <StatTile label="Fallidas" value={counts.failed} tone="critical" />
      <StatTile label="Tokens" value={formatTokens(tokens)} detail={`coste estimado ${formatCost(cost)}`} />
      <StatTile
        label="Tiempo de agentes"
        value={formatDuration(workingMs)}
        detail="suma de todas las ejecuciones"
      />
    </div>
  );
}
