import type { AgentActivityDto, FleetEvent } from '@fleet/shared';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { queryKeys } from '../../api/queryKeys';
import { newestActivity } from '../agents/agentActivityModel';

export const organizationEventsUrl = (organizationId: string) =>
  `/api/events?organizationId=${encodeURIComponent(organizationId)}`;

function applyOrganizationEvent(queryClient: QueryClient, organizationId: string, event: FleetEvent): void {
  if (event.type === 'agent.activity') {
    if (event.organizationId !== organizationId) return;
    queryClient.setQueryData<AgentActivityDto>(queryKeys.agentActivity(organizationId), (current) =>
      newestActivity(event.activity, current),
    );
    return;
  }
  if (event.type !== 'task.message_appended') {
    // A refetch already running answers this burst too.
    void queryClient.invalidateQueries({ queryKey: queryKeys.fleetStatus(organizationId) }, { cancelRefetch: false });
  }
}

/**
 * The shell's single SSE subscription to the current organization (reopened when it changes).
 * Task changes refresh the fleet status, `agent.activity` snapshots replace the cached agent
 * activity (no refetch; a reconnection refetches it, as events may have been missed) and every
 * event is handed to `onEvent`. Project caches are kept in sync by the project pages themselves
 * (useFleetEvents), not here.
 */
export function useOrganizationEvents(organizationId: string, onEvent: (event: FleetEvent) => void): void {
  const queryClient = useQueryClient();
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  });

  useEffect(() => {
    const source = new EventSource(organizationEventsUrl(organizationId));
    source.onmessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as FleetEvent;
      applyOrganizationEvent(queryClient, organizationId, event);
      handlerRef.current(event);
    };
    source.onopen = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentActivity(organizationId) }, { cancelRefetch: false });
    return () => source.close();
  }, [organizationId, queryClient]);
}
