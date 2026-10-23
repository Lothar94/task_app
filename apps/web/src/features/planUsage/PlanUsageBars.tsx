import type { PlanUsageView } from './planUsageModel';
import { unavailableReasonLabel } from './planUsageModel';
import { UsageBar } from './UsageBar';

/** Session and weekly bars of a snapshot, or the reason there are none. */
export function PlanUsageBars({ view, now }: { view: PlanUsageView; now: number }) {
  if (view.kind === 'unavailable') {
    return <p className="text-sm text-fg-muted">{unavailableReasonLabel(view.reason)}</p>;
  }
  const { session, weekly } = view.usage;
  if (!session && !weekly) return <p className="text-sm text-fg-muted">Tu plan no informa de límites de uso</p>;
  return (
    <div className="space-y-3">
      {session && <UsageBar label="Sesión (5 h)" window={session} now={now} />}
      {weekly && <UsageBar label="Semanal (7 d)" window={weekly} now={now} />}
    </div>
  );
}
