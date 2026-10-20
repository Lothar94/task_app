import type { AgentDto } from '@fleet/shared';
import { useMemo } from 'react';
import { FOCUS_RING } from '../../components/ui';
import { AgentGraph } from '../agents/diagram/AgentGraph';
import { type TopologyRow, topologyRows } from './inspectionModel';

function TopologyItem({ row }: { row: TopologyRow }) {
  return (
    <li className="py-2 text-sm">
      <span className="font-medium text-fg">{row.name}</span>
      <span className="text-fg-muted">
        {' '}
        · {row.role} · {row.model} · {row.state}
        {row.isOrchestrator && ' · orquestador'}
        {row.delegatesTo.length > 0 && ` · delega en: ${row.delegatesTo.join(', ')}`}
      </span>
    </li>
  );
}

export function SwarmTopology({
  members,
  orchestratorId,
  workingIds,
  onSelectAgent,
}: {
  members: AgentDto[];
  orchestratorId: string | null;
  workingIds: Set<string>;
  onSelectAgent: (agentId: string) => void;
}) {
  const rows = useMemo(
    () => topologyRows(members, orchestratorId, workingIds),
    [members, orchestratorId, workingIds],
  );
  return (
    <div className="space-y-3">
      <AgentGraph
        agents={members}
        highlightedIds={workingIds}
        orchestratorId={orchestratorId}
        showStatus
        onSelect={onSelectAgent}
      />
      <details className="rounded-lg border border-line bg-surface px-4 py-2">
        <summary className={`cursor-pointer font-mono text-xs text-fg-muted ${FOCUS_RING}`}>
          Ver como lista
        </summary>
        <ul className="divide-y divide-line" aria-label="Topología del enjambre como lista">
          {rows.map((row) => (
            <TopologyItem key={row.id} row={row} />
          ))}
        </ul>
      </details>
    </div>
  );
}
