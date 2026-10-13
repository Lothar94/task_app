import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type DashboardQuery, dashboardApi } from '../../api/dashboardApi';
import { queryKeys } from '../../api/queryKeys';

const REFRESH_MS = 15_000;

export const useDashboard = (query: DashboardQuery) =>
  useQuery({
    queryKey: queryKeys.dashboard(query.projectId, query.days),
    queryFn: () => dashboardApi.get(query),
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
  });
