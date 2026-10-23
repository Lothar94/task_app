// @vitest-environment jsdom
import type { FleetEvent, ProjectTelemetryDto, ProjectsTelemetryDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../api/queryKeys';
import { activityEvent } from '../features/agents/agentTestData';
import { TELEMETRY_REFETCH_INTERVAL_MS, useProjectsLiveTelemetry } from './useProjectsLiveTelemetry';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emit(event: FleetEvent) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }
}

const telemetryOf = (projectId: string, lastActivityAt: string | null): ProjectTelemetryDto => ({
  projectId,
  status: 'idle',
  counts: { total: 0, completed: 0, active: 0, failed: 0, cancelled: 0, planned: 0 },
  successRate: null,
  totalTokens: 0,
  costUsd: 0,
  agentTimeMs: 0,
  lastActivityAt,
  activeAgentIds: [],
  activeSubtask: null,
  alerts: [],
});

const snapshot: ProjectsTelemetryDto = {
  generatedAt: '2026-10-20T10:00:00.000Z',
  summary: {
    activeProjects: 1,
    activeProjectsWeeklyDelta: 0,
    activeTasks: 0,
    totalTasks: 0,
    completedTasks: 0,
    swarmAgentIds: [],
    totalTokens: 0,
    costUsd: 0,
  },
  projects: [telemetryOf('p1', '2026-10-20T09:00:00.000Z')],
};

const taskEvent = (type: 'task.created' | 'task.updated', projectId: string) =>
  ({ type, projectId, task: { id: 't1' } }) as unknown as FleetEvent;
const messageEvent = (projectId: string, createdAt: string) =>
  ({ type: 'task.message_appended', projectId, message: { id: 'm', taskId: 't1', createdAt } }) as FleetEvent;

describe('useProjectsLiveTelemetry', () => {
  let queryClient: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;
  const key = queryKeys.projectsTelemetry('org');

  const mount = () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const view = renderHook(() => useProjectsLiveTelemetry('org', ['p1']), { wrapper });
    return { ...view, source: FakeEventSource.instances[0]! };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource);
    FakeEventSource.instances = [];
    queryClient = new QueryClient();
    queryClient.setQueryData(key, snapshot);
    invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('listens to the global stream and invalidates on open', () => {
    const { source } = mount();
    expect(source.url).toBe('/api/events');
    source.onopen?.();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });

  it('throttles refetches to one per interval with a trailing call', () => {
    const { source } = mount();
    source.emit(taskEvent('task.updated', 'p1'));
    expect(invalidate).toHaveBeenCalledTimes(1);
    source.emit(taskEvent('task.created', 'p1'));
    source.emit(taskEvent('task.updated', 'p1'));
    expect(invalidate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TELEMETRY_REFETCH_INTERVAL_MS);
    expect(invalidate).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(TELEMETRY_REFETCH_INTERVAL_MS * 3);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('bumps lastActivityAt on new messages without refetching', () => {
    const { source } = mount();
    source.emit(messageEvent('p1', '2026-10-20T09:30:00.000Z'));
    const data = queryClient.getQueryData<ProjectsTelemetryDto>(key);
    expect(data?.projects[0]?.lastActivityAt).toBe('2026-10-20T09:30:00.000Z');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('ignores events of projects outside the organization', () => {
    const { source } = mount();
    source.emit(taskEvent('task.updated', 'other'));
    source.emit(messageEvent('other', '2026-10-20T09:59:00.000Z'));
    expect(invalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<ProjectsTelemetryDto>(key)).toBe(snapshot);
  });

  it('ignores agent activity snapshots', () => {
    const { source } = mount();
    source.emit(activityEvent());
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('closes the stream and drops pending refetches on unmount', () => {
    const { source, unmount } = mount();
    source.emit(taskEvent('task.updated', 'p1'));
    source.emit(taskEvent('task.updated', 'p1'));
    unmount();
    expect(source.closed).toBe(true);
    vi.advanceTimersByTime(TELEMETRY_REFETCH_INTERVAL_MS * 2);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
