import type { FleetStatusDto, SearchResultsDto } from '@fleet/shared';
import { request } from './httpClient';

export const shellApi = {
  search: (organizationId: string, query: string) =>
    request<SearchResultsDto>(
      `/organizations/${organizationId}/search?${new URLSearchParams({ q: query }).toString()}`,
    ),
  fleetStatus: (organizationId: string) =>
    request<FleetStatusDto>(`/organizations/${organizationId}/fleet-status`),
};
