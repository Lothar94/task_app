import type { FleetEvent } from '@fleet/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { queryKeys } from '../../api/queryKeys';

export const organizationEventsUrl = (organizationId: string) =>
  `/api/events?organizationId=${encodeURIComponent(organizationId)}`;

/**
 * The shell's single SSE subscription to the current organization (reopened when it changes).
 * Task changes refresh the fleet status; every event is handed to `onEvent`. Project caches are
 * kept in sync by the project pages themselves (useFleetEvents), not here.
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
      if (event.type !== 'task.message_appended') {
        // A refetch already running answers this burst too.
        void queryClient.invalidateQueries({ queryKey: queryKeys.fleetStatus(organizationId) }, { cancelRefetch: false });
      }
      handlerRef.current(event);
    };
    return () => source.close();
  }, [organizationId, queryClient]);
}
