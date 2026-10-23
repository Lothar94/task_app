import { PLAN_USAGE_REFRESH_MS } from '@fleet/shared';
import { useQuery } from '@tanstack/react-query';
import { planUsageApi } from '../../api/planUsageApi';
import { queryKeys } from '../../api/queryKeys';

/** Limits of the Claude subscription (not organization-scoped), polled at the server's refresh rate. */
export function usePlanUsage() {
  return useQuery({
    queryKey: queryKeys.planUsage,
    queryFn: planUsageApi.get,
    refetchInterval: PLAN_USAGE_REFRESH_MS,
    staleTime: PLAN_USAGE_REFRESH_MS / 2,
  });
}
