import type { AgentActivityDto, AgentDto } from '@fleet/shared';
import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../dashboard/dashboardQueries';
import { AgentList, type ExportSelection } from './AgentList';
import { AgentSheet } from './AgentSheet';
import { agentTrackRecord } from './agentSheetModel';
import { AgentGraph } from './diagram/AgentGraph';
import { FleetTiles } from './FleetTiles';

type Focusable = HTMLElement | SVGElement;

/** Selected agent of the sheet; the element that opened it gets the focus back on close. */
function useSheetSelection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const opener = useRef<Focusable | null>(null);
  const sheet = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selectedId) sheet.current?.focus();
  }, [selectedId]);

  const open = (id: string) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement || active instanceof SVGElement) opener.current = active;
    setSelectedId(id);
  };
  const close = (fallback: () => Focusable | null | undefined) => {
    setSelectedId(null);
    (opener.current?.isConnected ? opener.current : fallback())?.focus();
  };
  return { selectedId, sheet, open, close };
}

/** Diagram, alone or beside the list (dual), with the agent sheet opened on top of the page. */
export function AgentInspector({
  agents,
  activity,
  dual,
  selection,
}: {
  agents: AgentDto[];
  activity?: AgentActivityDto;
  dual: boolean;
  selection?: ExportSelection;
}) {
  const container = useRef<HTMLDivElement>(null);
  const { selectedId, sheet, open, close } = useSheetSelection();
  const dashboard = useDashboard({ projectId: null, days: null });
  const selected = agents.find((agent) => agent.id === selectedId);
  const closeSheet = () =>
    close(() => container.current?.querySelector<SVGElement>(`[data-agent-id="${selectedId}"]`));
  const graph = (
    <AgentGraph agents={agents} activity={activity} zoomable selectedId={selectedId} onSelect={open} />
  );

  return (
    <div
      ref={container}
      className={selected ? 'space-y-6 lg:pr-[24rem]' : 'space-y-6'}
      onKeyDown={(event) => event.key === 'Escape' && selected && closeSheet()}
    >
      {dual ? (
        <div
          data-testid="dual-view"
          className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
        >
          <AgentList agents={agents} selection={selection} inspection={{ selectedId, onSelect: open }} />
          {graph}
        </div>
      ) : (
        graph
      )}
      {selected && (
        <AgentSheet
          key={selected.id}
          ref={sheet}
          agent={selected}
          record={dashboard.data && agentTrackRecord(dashboard.data.byAgent, selected.id)}
          onClose={closeSheet}
        />
      )}
      <FleetTiles agents={agents} />
    </div>
  );
}
