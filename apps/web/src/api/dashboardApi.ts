import type { DashboardDto } from '@fleet/shared';
import { request } from './httpClient';

export interface DashboardQuery {
  projectId: string | null;
  days: number | null;
}

export const dashboardApi = {
  get: ({ projectId, days }: DashboardQuery) => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (days) params.set('days', String(days));
    const query = params.toString();
    return request<DashboardDto>(`/dashboard${query ? `?${query}` : ''}`);
  },
};
