// @vitest-environment jsdom
import type { FleetEvent, ProjectTelemetryDto, ProjectsTelemetryDto } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../api/queryKeys';
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
    activeProjects: 2,
    activeProjectsWeeklyDelta: 0,
    activeTasks: 0,
    totalTasks: 0,
    completedTasks: 0,
    swarmAgentIds: [],
    totalTokens: 0,
    costUsd: 0,
  },
  projects: [telemetryOf('p1', '2026-10-20T09:00:00.000Z'), telemetryOf('p2', null)],
};

const taskUpdated = (projectId: string) =>
  ({ type: 'task.updated', projectId, task: { id: 't1' } }) as unknown as FleetEvent;
const messageEvent = (projectId: string, createdAt: string) =>
  ({ type: 'task.message_appended', projectId, message: { id: 'm', taskId: 't1', createdAt } }) as FleetEvent;

describe('useProjectsLiveTelemetry (QA, criterion 2)', () => {
  let queryClient: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;
  const key = queryKeys.projectsTelemetry('org');

  const mount = (preload: boolean) => {
    if (preload) queryClient.setQueryData(key, snapshot);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const view = renderHook(() => useProjectsLiveTelemetry('org', ['p1', 'p2']), { wrapper });
    return { ...view, source: FakeEventSource.instances[0]! };
  };
  const lastActivity = (projectId: string) =>
    queryClient
      .getQueryData<ProjectsTelemetryDto>(key)
      ?.projects.find((project) => project.projectId === projectId)?.lastActivityAt;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource);
    FakeEventSource.instances = [];
    queryClient = new QueryClient();
    invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('ignores task and message events of foreign projects', () => {
    const { source } = mount(true);
    source.emit(taskUpdated('foreign'));
    source.emit(messageEvent('foreign', '2026-10-20T09:59:00.000Z'));
    vi.advanceTimersByTime(TELEMETRY_REFETCH_INTERVAL_MS * 3);
    expect(invalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<ProjectsTelemetryDto>(key)).toBe(snapshot);
  });

  it('message_appended before the telemetry is loaded neither throws nor creates data', () => {
    const { source } = mount(false);
    expect(() => source.emit(messageEvent('p1', '2026-10-20T09:59:00.000Z'))).not.toThrow();
    expect(queryClient.getQueryData(key)).toBeUndefined();
    expect(queryClient.getQueryCache().find({ queryKey: key })?.state.data).toBeUndefined();
  });

  it('does not move lastActivityAt backwards with an older message', () => {
    const { source } = mount(true);
    source.emit(messageEvent('p1', '2026-10-20T08:00:00.000Z'));
    expect(lastActivity('p1')).toBe('2026-10-20T09:00:00.000Z');
    source.emit(messageEvent('p1', '2026-10-20T09:00:00.000Z'));
    expect(lastActivity('p1')).toBe('2026-10-20T09:00:00.000Z');
  });

  it('sets lastActivityAt when the project had none and keeps other projects untouched', () => {
    const { source } = mount(true);
    source.emit(messageEvent('p2', '2026-10-20T09:30:00.000Z'));
    expect(lastActivity('p2')).toBe('2026-10-20T09:30:00.000Z');
    expect(lastActivity('p1')).toBe('2026-10-20T09:00:00.000Z');
  });

  it('a burst of task.updated events gives one immediate and one trailing refetch', () => {
    const { source } = mount(true);
    for (let i = 0; i < 50; i += 1) source.emit(taskUpdated('p1'));
    expect(invalidate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TELEMETRY_REFETCH_INTERVAL_MS);
    expect(invalidate).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(TELEMETRY_REFETCH_INTERVAL_MS * 5);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('refetches on every (re)connection', () => {
    const { source } = mount(true);
    source.onopen?.();
    source.onopen?.();
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });

  it('closes the source on unmount and opens a single stream', () => {
    const { source, unmount } = mount(true);
    expect(FakeEventSource.instances).toHaveLength(1);
    unmount();
    expect(source.closed).toBe(true);
  });
});
