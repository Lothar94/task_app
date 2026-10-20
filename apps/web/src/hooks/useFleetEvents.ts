import type { ConversationMessageDto, FleetEvent, TaskDto } from '@fleet/shared';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryKeys } from '../api/queryKeys';

function appendMessage(queryClient: QueryClient, message: ConversationMessageDto): void {
  queryClient.setQueryData<ConversationMessageDto[]>(queryKeys.conversation(message.taskId), (messages) => {
    if (!messages || messages.some((existing) => existing.id === message.id)) return messages;
    return [...messages, message];
  });
}

/** A task's telemetry changes with its runs; its ancestors' subtree totals change with it. */
function invalidateTelemetry(queryClient: QueryClient, task: TaskDto): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.execution(task.id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.git(task.id) });
  const visited = new Set([task.id]);
  let parentId = task.parentTaskId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    void queryClient.invalidateQueries({ queryKey: queryKeys.execution(parentId) });
    parentId = queryClient.getQueryData<TaskDto>(queryKeys.task(parentId))?.parentTaskId ?? null;
  }
}

function applyEvent(queryClient: QueryClient, event: FleetEvent): void {
  if (event.type === 'task.message_appended') {
    appendMessage(queryClient, event.message);
    return;
  }
  queryClient.setQueryData(queryKeys.task(event.task.id), event.task);
  void queryClient.invalidateQueries({ queryKey: queryKeys.taskTree(event.projectId) });
  if (event.type === 'task.updated') invalidateTelemetry(queryClient, event.task);
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
