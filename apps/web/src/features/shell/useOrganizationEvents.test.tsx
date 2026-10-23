// @vitest-environment jsdom
import type { AgentActivityDto, FleetEvent } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../api/queryKeys';
import { activityEvent, activityFixture } from '../agents/agentTestData';
import { updated } from './notificationTestData';
import { useOrganizationEvents } from './useOrganizationEvents';

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

describe('useOrganizationEvents', () => {
  let queryClient: QueryClient;
  const onEvent = vi.fn();

  const mount = () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return renderHook(({ organizationId }) => useOrganizationEvents(organizationId, onEvent), {
      wrapper,
      initialProps: { organizationId: 'org a' },
    });
  };

  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    queryClient = new QueryClient();
    onEvent.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('subscribes to the organization stream and hands every event over', () => {
    mount();
    const [source] = FakeEventSource.instances;
    expect(source?.url).toBe('/api/events?organizationId=org%20a');
    const event = updated({ status: 'failed' });
    source?.emit(event);
    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('refreshes the fleet status on task events only', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    mount();
    const [source] = FakeEventSource.instances;
    source?.emit({ type: 'task.message_appended', projectId: 'p1', message: {} } as FleetEvent);
    expect(invalidate).not.toHaveBeenCalled();
    source?.emit(updated());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.fleetStatus('org a') }, { cancelRefetch: false });
  });

  it('stores agent activity snapshots of its organization without refetching', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    mount();
    const [source] = FakeEventSource.instances;
    const working = activityFixture({
      organizationId: 'org a',
      agents: [{ agentId: 'a1', state: 'working', activeTasks: 1, currentTask: { taskId: 't', projectId: 'p', number: 3, title: 'Login' } }],
    });
    source?.emit(activityEvent(working));
    source?.emit(activityEvent(activityFixture({ organizationId: 'org-b' })));
    expect(queryClient.getQueryData(queryKeys.agentActivity('org a'))).toEqual(working);
    expect(queryClient.getQueryData(queryKeys.agentActivity('org-b'))).toBeUndefined();
    expect(invalidate).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it('keeps the newest activity snapshot when an older one arrives late', () => {
    mount();
    const [source] = FakeEventSource.instances;
    const newer = activityFixture({ organizationId: 'org a', generatedAt: '2026-10-23T10:00:05.000Z' });
    source?.emit(activityEvent(newer));
    source?.emit(activityEvent(activityFixture({ organizationId: 'org a', generatedAt: '2026-10-23T10:00:00.000Z' })));
    expect(queryClient.getQueryData<AgentActivityDto>(queryKeys.agentActivity('org a'))).toEqual(newer);
  });

  it('refetches the agent activity when the stream (re)opens, as events may have been missed', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    mount();
    FakeEventSource.instances[0]?.onopen?.();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.agentActivity('org a') }, { cancelRefetch: false });
  });

  it('reconnects when the organization changes and closes on unmount', () => {
    const view = mount();
    view.rerender({ organizationId: 'org-b' });
    const [first, second] = FakeEventSource.instances;
    expect(first?.closed).toBe(true);
    expect(second?.url).toBe('/api/events?organizationId=org-b');
    view.unmount();
    expect(second?.closed).toBe(true);
  });
});
