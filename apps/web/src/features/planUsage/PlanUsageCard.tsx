import { Gauge } from 'lucide-react';
import { Card, Loading } from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { PlanUsageBars } from './PlanUsageBars';
import { subscriptionLabel, toPlanUsageView } from './planUsageModel';
import { usePlanUsage } from './usePlanUsage';

const NOW_REFRESH_MS = 30_000;

/** Dashboard card with the limits of the Claude subscription; independent from the dashboard filters. */
export function PlanUsageCard() {
  const planUsage = usePlanUsage();
  const now = useNow(true, NOW_REFRESH_MS);
  const view = toPlanUsageView(planUsage.data, planUsage.isError);
  const subscriptionType = view?.kind === 'available' ? view.usage.subscriptionType : null;

  return (
    <Card
      title="Límites de uso de Claude"
      icon={<Gauge />}
      meta={subscriptionType ? subscriptionLabel(subscriptionType) : undefined}
    >
      {view ? <PlanUsageBars view={view} now={now} /> : <Loading />}
    </Card>
  );
}
