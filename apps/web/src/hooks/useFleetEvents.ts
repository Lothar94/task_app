import type { ConversationMessageDto, FleetEvent } from '@fleet/shared';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../api/queryKeys';

function appendMessage(queryClient: QueryClient, message: ConversationMessageDto): void {
  queryClient.setQueryData<ConversationMessageDto[]>(queryKeys.conversation(message.taskId), (messages) => {
    if (!messages || messages.some((existing) => existing.id === message.id)) return messages;
    return [...messages, message];
  });
}

function applyEvent(queryClient: QueryClient, event: FleetEvent): void {
  if (event.type === 'task.message_appended') {
    appendMessage(queryClient, event.message);
    return;
  }
  queryClient.setQueryData(queryKeys.task(event.task.id), event.task);
  void queryClient.invalidateQueries({ queryKey: queryKeys.taskTree(event.projectId) });
}

/** Keeps cached tasks and conversations of a project in sync with the server in real time. */
export function useFleetEvents(projectId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return undefined;
    const source = new EventSource(`/api/events?projectId=${encodeURIComponent(projectId)}`);
    source.onmessage = (message: MessageEvent<string>) => {
      applyEvent(queryClient, JSON.parse(message.data) as FleetEvent);
    };
    source.onopen = () => void queryClient.invalidateQueries({ queryKey: queryKeys.taskTree(projectId) });
    return () => source.close();
  }, [projectId, queryClient]);
}
