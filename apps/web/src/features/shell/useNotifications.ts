import type { FleetEvent } from '@fleet/shared';
import { useCallback, useEffect, useState } from 'react';
import { applyFleetEvent, countUnread, type FleetNotification, markAllRead, markRead } from './notificationModel';
import { loadNotifications, saveNotifications } from './notificationStorage';
import { useOrganizationEvents } from './useOrganizationEvents';

interface NotificationsState {
  organizationId: string;
  items: FleetNotification[];
}

const loadState = (organizationId: string): NotificationsState => ({
  organizationId,
  items: loadNotifications(organizationId),
});

/** Notification center of the current organization, fed by its live events and remembered per organization. */
export function useNotifications(organizationId: string) {
  const [state, setState] = useState(() => loadState(organizationId));
  if (state.organizationId !== organizationId) setState(loadState(organizationId));

  const update = useCallback((change: (items: FleetNotification[]) => FleetNotification[]) => {
    setState((current) => {
      const items = change(current.items);
      return items === current.items ? current : { ...current, items };
    });
  }, []);

  useEffect(() => saveNotifications(state.organizationId, state.items), [state]);

  useOrganizationEvents(organizationId, (event: FleetEvent) =>
    update((items) => applyFleetEvent(items, event, new Date().toISOString())),
  );

  return {
    items: state.items,
    unreadCount: countUnread(state.items),
    markRead: (id: string) => update((items) => markRead(items, id)),
    markAllRead: () => update(markAllRead),
  };
}
