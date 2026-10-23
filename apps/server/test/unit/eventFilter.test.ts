import type { FleetEvent } from '@fleet/shared';
import { describe, expect, it, vi } from 'vitest';
import { createEventFilter } from '../../src/interfaces/http/eventFilter.js';

const event = (projectId: string): FleetEvent =>
  ({ type: 'task.created', projectId, task: {} }) as unknown as FleetEvent;

const owners: Record<string, string> = { p1: 'orgA', p2: 'orgA', p3: 'orgB' };
const lookup = () => vi.fn((projectId: string) => owners[projectId] ?? null);

describe('createEventFilter', () => {
  it('lets everything through without criteria', () => {
    const organizationOf = lookup();
    expect(createEventFilter({}, organizationOf)(event('p3'))).toBe(true);
    expect(organizationOf).not.toHaveBeenCalled();
  });

  it('keeps the events of one project', () => {
    const accepts = createEventFilter({ projectId: 'p1' }, lookup());
    expect(accepts(event('p1'))).toBe(true);
    expect(accepts(event('p2'))).toBe(false);
  });

  it('keeps the events of the projects of one organization', () => {
    const accepts = createEventFilter({ organizationId: 'orgA' }, lookup());
    expect(accepts(event('p1'))).toBe(true);
    expect(accepts(event('p2'))).toBe(true);
    expect(accepts(event('p3'))).toBe(false);
  });

  it('drops events of unknown projects', () => {
    expect(createEventFilter({ organizationId: 'orgA' }, lookup())(event('ghost'))).toBe(false);
  });

  it('combines both criteria', () => {
    const accepts = createEventFilter({ organizationId: 'orgA', projectId: 'p1' }, lookup());
    expect(accepts(event('p1'))).toBe(true);
    expect(accepts(event('p2'))).toBe(false);
    expect(accepts(event('p3'))).toBe(false);
  });

  it('resolves each project once per connection', () => {
    const organizationOf = lookup();
    const accepts = createEventFilter({ organizationId: 'orgA' }, organizationOf);
    accepts(event('p1'));
    accepts(event('p1'));
    expect(organizationOf).toHaveBeenCalledTimes(1);
  });

  it('does not cache unknown projects, so later-created ones are found', () => {
    const late: Record<string, string> = {};
    const accepts = createEventFilter({ organizationId: 'orgA' }, (id) => late[id] ?? null);
    expect(accepts(event('p9'))).toBe(false);
    late.p9 = 'orgA';
    expect(accepts(event('p9'))).toBe(true);
  });
});

describe('createEventFilter with agent.activity', () => {
  const activity = (organizationId: string): FleetEvent => ({
    type: 'agent.activity',
    organizationId,
    activity: { organizationId, agents: [], delegations: [], generatedAt: '2026-10-23T10:00:00.000Z' },
  });

  it('reaches unfiltered connections', () => {
    expect(createEventFilter({}, lookup())(activity('orgA'))).toBe(true);
  });

  it('passes the filter of its own organization only, without resolving projects', () => {
    const organizationOf = lookup();
    const accepts = createEventFilter({ organizationId: 'orgA' }, organizationOf);
    expect(accepts(activity('orgA'))).toBe(true);
    expect(accepts(activity('orgB'))).toBe(false);
    expect(organizationOf).not.toHaveBeenCalled();
  });

  it('never passes a project filter', () => {
    expect(createEventFilter({ projectId: 'p1' }, lookup())(activity('orgA'))).toBe(false);
    expect(createEventFilter({ projectId: 'p1', organizationId: 'orgA' }, lookup())(activity('orgA'))).toBe(
      false,
    );
  });
});
