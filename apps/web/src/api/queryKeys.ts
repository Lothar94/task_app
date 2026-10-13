export const queryKeys = {
  agents: ['agents'] as const,
  agent: (id: string) => ['agents', id] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  taskTree: (projectId: string) => ['task-tree', projectId] as const,
  task: (id: string) => ['tasks', id] as const,
  conversation: (taskId: string) => ['conversation', taskId] as const,
  dashboard: (projectId: string | null, days: number | null) => ['dashboard', projectId, days] as const,
};
