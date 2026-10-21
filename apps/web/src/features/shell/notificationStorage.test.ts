// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyFleetEvent, MAX_NOTIFICATIONS } from './notificationModel';
import { loadNotifications, saveNotifications } from './notificationStorage';
import { updated } from './notificationTestData';

const failed = applyFleetEvent([], updated({ status: 'failed' }), '2026-10-21T09:00:00.000Z');

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('notification storage', () => {
  it('round-trips per organization', () => {
    saveNotifications('org-a', failed);
    expect(loadNotifications('org-a')).toEqual(failed);
    expect(loadNotifications('org-b')).toEqual([]);
  });

  it('reads corrupt or foreign data as empty and drops malformed entries', () => {
    localStorage.setItem('fleet.notifications.org', '{not json');
    expect(loadNotifications('org')).toEqual([]);
    localStorage.setItem('fleet.notifications.org', '{"a":1}');
    expect(loadNotifications('org')).toEqual([]);
    localStorage.setItem('fleet.notifications.org', JSON.stringify([...failed, { id: 'x', kind: 'other' }, null]));
    expect(loadNotifications('org')).toEqual(failed);
  });

  it('caps what it stores and survives unavailable storage', () => {
    const many = Array.from({ length: MAX_NOTIFICATIONS + 3 }, (_, index) => ({ ...failed[0]!, id: `t${index}:failed` }));
    saveNotifications('org', many);
    expect(loadNotifications('org')).toHaveLength(MAX_NOTIFICATIONS);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveNotifications('org', failed)).not.toThrow();
    expect(loadNotifications('org')).toEqual([]);
  });
});
