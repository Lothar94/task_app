import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type DashboardQuery, dashboardApi } from '../../api/dashboardApi';
import { queryKeys } from '../../api/queryKeys';
import { useCurrentOrganization } from '../organizations/OrganizationContext';

const REFRESH_MS = 15_000;

export function useDashboard(query: DashboardQuery) {
  const { id: organizationId } = useCurrentOrganization();
  return useQuery({
    queryKey: queryKeys.dashboard(organizationId, query.projectId, query.days),
    queryFn: () => dashboardApi.get(organizationId, query),
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}
