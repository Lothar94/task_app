import type { AgentActivityDto, FleetEvent } from '@fleet/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentActivityNotifier } from '../../src/application/fleet/AgentActivityNotifier.js';
import type { GetAgentActivity } from '../../src/application/fleet/GetAgentActivity.js';
import type { ProjectRepository } from '../../src/application/ports/ProjectRepository.js';
import { InMemoryEventBus } from '../../src/infrastructure/events/InMemoryEventBus.js';

const owners: Readonly<Record<string, string>> = { p1: 'orgA', p2: 'orgA', p3: 'orgB' };
const projects = {
  findById: vi.fn((id: string) => (owners[id] ? { organizationId: owners[id] } : null)),
} as unknown as ProjectRepository;

const taskEvent = (type: 'task.created' | 'task.updated', projectId: string) =>
  ({ type, projectId, task: {} }) as unknown as FleetEvent;

describe('AgentActivityNotifier', () => {
  let bus: InMemoryEventBus;
  let published: FleetEvent[];
  let snapshots: number;
  const errors: unknown[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new InMemoryEventBus();
    published = [];
    snapshots = 0;
    errors.length = 0;
    const activity = {
      execute: (organizationId: string): AgentActivityDto => {
        snapshots += 1;
        return { organizationId, agents: [], delegations: [], generatedAt: `snapshot-${snapshots}` };
      },
    } as unknown as GetAgentActivity;
    const logger = {
      info: () => undefined,
      warn: () => undefined,
      error: (_: string, e: unknown) => void errors.push(e),
    };
    new AgentActivityNotifier(projects, activity, bus, logger, 100).watch(bus);
    bus.subscribe((event) => {
      if (event.type === 'agent.activity') published.push(event);
    });
  });
  afterEach(() => vi.useRealTimers());

  it('collapses a burst of task changes into one snapshot per organization', () => {
    bus.publish(taskEvent('task.created', 'p1'));
    bus.publish(taskEvent('task.updated', 'p2'));
    bus.publish(taskEvent('task.updated', 'p1'));
    bus.publish(taskEvent('task.updated', 'p3'));
    expect(published).toEqual([]);

    vi.advanceTimersByTime(100);

    expect(published.map((event) => event.type === 'agent.activity' && event.organizationId)).toEqual([
      'orgA',
      'orgB',
    ]);
    expect(snapshots).toBe(2);
  });

  it('emits again for changes after the previous emission', () => {
    bus.publish(taskEvent('task.updated', 'p1'));
    vi.advanceTimersByTime(100);
    bus.publish(taskEvent('task.updated', 'p1'));
    vi.advanceTimersByTime(99);
    expect(published).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(published).toHaveLength(2);
  });

  it('ignores messages, its own events and unknown projects', () => {
    bus.publish({ type: 'task.message_appended', projectId: 'p1', message: {} } as unknown as FleetEvent);
    bus.publish(taskEvent('task.updated', 'ghost'));
    vi.advanceTimersByTime(1000);
    expect(published).toEqual([]);
  });

  it('logs a failed snapshot instead of throwing from the timer', () => {
    const failing = {
      execute: () => {
        throw new Error('boom');
      },
    } as unknown as GetAgentActivity;
    const logger = {
      info: () => undefined,
      warn: () => undefined,
      error: (_: string, e: unknown) => void errors.push(e),
    };
    const isolated = new InMemoryEventBus();
    new AgentActivityNotifier(projects, failing, isolated, logger, 100).watch(isolated);

    isolated.publish(taskEvent('task.updated', 'p1'));
    vi.advanceTimersByTime(100);

    expect(errors).toEqual([new Error('boom')]);
  });
});
