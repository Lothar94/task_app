import type { TaskNodeDto } from '@fleet/shared';
import { StatTile } from '../../components/StatTile';
import { formatCost, formatDuration, formatTokens } from '../../lib/format';
import { countTasks, subtreeMetrics } from '../tasks/taskTreeModel';

export function ProjectStats({ nodes }: { nodes: TaskNodeDto[] }) {
  const counts = countTasks(nodes);
  const metrics = nodes.map(subtreeMetrics);
  const tokens = metrics.reduce((sum, item) => sum + item.totalTokens, 0);
  const cost = metrics.reduce((sum, item) => sum + item.costUsd, 0);
  const workingMs = metrics.reduce((sum, item) => sum + item.durationMs, 0);
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
