import type { FleetNodeDto } from '@fleet/shared';
import { type FleetStatusSnapshot, useFleetStatus } from './useFleetStatus';

/** "Lara (2) · Vega (1)": active agents with their number of active tasks. */
export const formatNodes = (nodes: FleetNodeDto[]) =>
  nodes.map((node) => `${node.name} (${node.activeTasks})`).join(' · ');

interface StatePresentation {
  label: string;
  dot: string;
}

function statePresentation(snapshot: FleetStatusSnapshot | undefined, isError: boolean): StatePresentation {
  if (isError) return { label: 'API sin conexión', dot: 'bg-danger' };
  if (!snapshot) return { label: 'Flota: conectando…', dot: 'bg-fg-subtle' };
  return snapshot.status.state === 'active'
    ? { label: 'Flota: Activa', dot: 'bg-success motion-safe:animate-pulse' }
    : { label: 'Flota: En reposo', dot: 'bg-fg-subtle' };
}

function FleetDetails({ snapshot }: { snapshot: FleetStatusSnapshot }) {
  const { activeNodes } = snapshot.status;
  return (
    <>
      <span aria-hidden className="hidden h-3 w-px shrink-0 bg-line-strong sm:inline-block" />
      <span className="hidden min-w-0 truncate sm:inline">
        Nodos activos: {activeNodes.length > 0 ? formatNodes(activeNodes) : 'ninguno'}
      </span>
    </>
  );
}

/** Sticky footer micro-bar: fleet state, busy agents, API latency and app version. */
export function FleetStatusBar() {
  const fleet = useFleetStatus();
  const snapshot = fleet.data;
  const { label, dot } = statePresentation(snapshot, fleet.isError);
  const isHealthy = snapshot !== undefined && !fleet.isError;

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-(--status-bar-height) items-center justify-between gap-4 border-t border-line bg-canvas px-4 font-mono text-[0.6875rem] text-fg-subtle">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center gap-1.5">
          <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
          <span role="status" className={fleet.isError ? 'text-danger' : 'text-fg'}>
            {label}
          </span>
        </span>
        {isHealthy && <FleetDetails snapshot={snapshot} />}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {isHealthy && <span className="hidden md:inline">Latencia: {snapshot.latencyMs} ms</span>}
        {snapshot && <span>v{snapshot.status.version}</span>}
      </div>
    </footer>
  );
}
