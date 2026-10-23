import type { FleetEvent, ProjectsTelemetryDto } from '@fleet/shared';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../api/queryKeys';

export const TELEMETRY_REFETCH_INTERVAL_MS = 1000;

function bumpLastActivity(queryClient: QueryClient, organizationId: string, projectId: string, at: string) {
  queryClient.setQueryData<ProjectsTelemetryDto>(queryKeys.projectsTelemetry(organizationId), (data) => {
    if (!data) return data;
    return {
      ...data,
      projects: data.projects.map((project) =>
        project.projectId === projectId && (project.lastActivityAt ?? '') < at
          ? { ...project, lastActivityAt: at }
          : project,
      ),
    };
  });
}

/**
 * Keeps the projects telemetry of an organization fresh from the global SSE stream: task changes
 * refetch it (at most once per interval, trailing) and new messages only bump `lastActivityAt`.
 * Events of projects outside the organization are ignored.
 */
export function useProjectsLiveTelemetry(organizationId: string, projectIds: string[]): void {
  const queryClient = useQueryClient();
  const projectKey = projectIds.join('\n');

  useEffect(() => {
    const known = new Set(projectKey === '' ? [] : projectKey.split('\n'));
    const queryKey = queryKeys.projectsTelemetry(organizationId);
    let lastRefetch = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refetch = () => {
      timer = undefined;
      lastRefetch = Date.now();
      void queryClient.invalidateQueries({ queryKey });
    };
    const refetchThrottled = () => {
      if (timer !== undefined) return;
      const wait = Math.max(0, lastRefetch + TELEMETRY_REFETCH_INTERVAL_MS - Date.now());
      if (wait === 0) refetch();
      else timer = setTimeout(refetch, wait);
    };

    const source = new EventSource('/api/events');
    source.onmessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as FleetEvent;
      if (event.type === 'agent.activity' || !known.has(event.projectId)) return;
      if (event.type === 'task.message_appended') {
        bumpLastActivity(queryClient, organizationId, event.projectId, event.message.createdAt);
      } else refetchThrottled();
    };
    source.onopen = () => void queryClient.invalidateQueries({ queryKey });
    return () => {
      source.close();
      clearTimeout(timer);
    };
  }, [organizationId, projectKey, queryClient]);
}
