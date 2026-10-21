import type { FleetStatusDto } from '@fleet/shared';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { shellApi } from '../../api/shellApi';
import { useCurrentOrganization } from '../organizations/OrganizationContext';

export const FLEET_STATUS_POLL_MS = 15_000;

export interface FleetStatusSnapshot {
  status: FleetStatusDto;
  /** Round trip of the request that brought `status`. */
  latencyMs: number;
}

async function fetchMeasured(organizationId: string): Promise<FleetStatusSnapshot> {
  const startedAt = performance.now();
  const status = await shellApi.fleetStatus(organizationId);
  return { status, latencyMs: Math.round(performance.now() - startedAt) };
}

/** Fleet status of the current organization, polled (and refreshed by live task events). */
export function useFleetStatus() {
  const { id: organizationId } = useCurrentOrganization();
  return useQuery({
    queryKey: queryKeys.fleetStatus(organizationId),
    queryFn: () => fetchMeasured(organizationId),
    refetchInterval: FLEET_STATUS_POLL_MS,
  });
}
