// @vitest-environment jsdom
import type { FleetEvent } from '@fleet/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activityEvent } from '../features/agents/agentTestData';
import { useFleetEvents } from './useFleetEvents';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  onopen: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {}
  emit(event: FleetEvent) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }
}

describe('useFleetEvents', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ignores agent activity snapshots', () => {
    const queryClient = new QueryClient();
    const setData = vi.spyOn(queryClient, 'setQueryData');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    renderHook(() => useFleetEvents('p1'), { wrapper });
    expect(() => FakeEventSource.instances[0]?.emit(activityEvent())).not.toThrow();
    expect(setData).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
