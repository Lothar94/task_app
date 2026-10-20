import type { AgentDto, ProjectsSummaryDto } from '@fleet/shared';
import { Activity, Check, Coins, Users } from 'lucide-react';
import { StatTile } from '../../components/StatTile';
import { formatCost, formatInteger, formatTokens } from '../../lib/format';
import { swarmLabel, weeklyDeltaLabel } from './projectListModel';

/** Headline figures; `summary` is undefined while the telemetry loads or when it failed. */
export function ProjectTiles({
  summary,
  activeProjects,
  agents,
}: {
  summary?: ProjectsSummaryDto;
  /** Fallback count when there is no telemetry. */
  activeProjects: number;
  agents: AgentDto[];
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Proyectos activos"
        value={summary?.activeProjects ?? activeProjects}
        detail={summary && weeklyDeltaLabel(summary.activeProjectsWeeklyDelta)}
        icon={<Check />}
        tone="good"
      />
      <StatTile
        label="Tareas en curso"
        value={summary ? formatInteger(summary.activeTasks) : '…'}
        detail={
          summary &&
          `${formatInteger(summary.totalTasks)} totales (${formatInteger(summary.completedTasks)} completadas)`
        }
        icon={<Activity />}
      />
      <StatTile
        label="Agentes en el enjambre"
        value={summary ? summary.swarmAgentIds.length : '…'}
        detail={summary && swarmLabel(summary.swarmAgentIds, agents)}
        icon={<Users />}
      />
      <StatTile
        label="Consumo de tokens"
        value={summary ? formatTokens(summary.totalTokens) : '…'}
        detail={summary && `~${formatCost(summary.costUsd)} USD`}
        icon={<Coins />}
      />
    </div>
  );
}
