export const queryKeys = {
  organizations: ['organizations'] as const,
  agents: (organizationId: string) => ['agents', organizationId] as const,
  skills: ['skills'] as const,
  agent: (id: string) => ['agent', id] as const,
  projects: (organizationId: string) => ['projects', organizationId] as const,
  project: (id: string) => ['project', id] as const,
  taskTree: (projectId: string) => ['task-tree', projectId] as const,
  task: (id: string) => ['tasks', id] as const,
  conversation: (taskId: string) => ['conversation', taskId] as const,
  dashboard: (organizationId: string, projectId: string | null, days: number | null) =>
    ['dashboard', organizationId, projectId, days] as const,
};
