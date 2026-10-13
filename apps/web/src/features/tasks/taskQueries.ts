import type { AssignTaskInput, TaskDto, UpdateTaskInput } from '@fleet/shared';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasksApi';

export const useTaskTree = (projectId: string) =>
  useQuery({ queryKey: queryKeys.taskTree(projectId), queryFn: () => tasksApi.tree(projectId) });

export const useTask = (id: string) =>
  useQuery({ queryKey: queryKeys.task(id), queryFn: () => tasksApi.get(id) });

export const useConversation = (taskId: string) =>
  useQuery({ queryKey: queryKeys.conversation(taskId), queryFn: () => tasksApi.conversation(taskId) });

export function useAssignTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignTaskInput) => tasksApi.assign(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.taskTree(projectId) }),
  });
}

export const useFollowUp = (taskId: string) =>
  useMutation({ mutationFn: (message: string) => tasksApi.followUp(taskId, message) });

function invalidateTaskViews(queryClient: QueryClient, projectId: string, taskId?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.taskTree(projectId) });
  if (taskId) void queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
}

/** Mutation on a single task whose result changes the project tree and that task. */
function useTaskAction(action: (id: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: (_result, id) => {
      const projectId = queryClient.getQueryData<TaskDto>(queryKeys.task(id))?.projectId;
      if (projectId) invalidateTaskViews(queryClient, projectId, id);
      else void queryClient.invalidateQueries({ queryKey: ['task-tree'] });
    },
  });
}

export const useStartTask = () => useTaskAction(tasksApi.start);
export const useEnqueueTask = () => useTaskAction(tasksApi.enqueue);
export const useDequeueTask = () => useTaskAction(tasksApi.dequeue);

export function useUpdateTask(task: TaskDto) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => tasksApi.update(task.id, input),
    onSuccess: () => invalidateTaskViews(queryClient, task.projectId, task.id),
  });
}

export function useReorderQueue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskIds: string[]) => tasksApi.reorderQueue(projectId, { taskIds }),
    onSuccess: () => invalidateTaskViews(queryClient, projectId),
  });
}

export const useCancelTask = () => useTaskAction(tasksApi.cancel);
