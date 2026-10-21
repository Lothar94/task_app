// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyFleetEvent, MAX_NOTIFICATIONS } from './notificationModel';
import { loadNotifications, saveNotifications } from './notificationStorage';
import { updated } from './notificationTestData';

const valid = applyFleetEvent([], updated({ status: 'failed' }), '2026-10-21T09:00:00.000Z')[0]!;
const key = (org: string) => `fleet.notifications.${org}`;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('notification storage QA', () => {
  it.each([
    ['empty string', ''],
    ['null literal', 'null'],
    ['number', '42'],
    ['string', '"hello"'],
    ['truncated json', '[{"id":"t1:failed"'],
    ['array of primitives', '[1,"a",null,true]'],
  ])('reads %s as empty', (_name, raw) => {
    localStorage.setItem(key('org'), raw);
    expect(loadNotifications('org')).toEqual([]);
  });

  it('drops entries with a wrong field type, a missing field or an unknown kind, keeping the good ones', () => {
    const { taskNumber: _omitted, ...missing } = valid;
    localStorage.setItem(
      key('org'),
      JSON.stringify([
        { ...valid, taskNumber: '7' },
        { ...valid, read: 'false' },
        { ...valid, kind: 'info' },
        missing,
        { ...valid, id: 'ok:failed' },
      ]),
    );
    expect(loadNotifications('org').map((item) => item.id)).toEqual(['ok:failed']);
  });

  it('truncates an oversized stored list to the maximum', () => {
    const many = Array.from({ length: MAX_NOTIFICATIONS + 10 }, (_, i) => ({ ...valid, id: `t${i}:failed` }));
    localStorage.setItem(key('org'), JSON.stringify(many));
    expect(loadNotifications('org')).toHaveLength(MAX_NOTIFICATIONS);
  });

  it('keeps organizations apart even when the id contains separators', () => {
    saveNotifications('a', [valid]);
    saveNotifications('a.b', [{ ...valid, id: 'other:failed' }]);
    expect(loadNotifications('a').map((item) => item.id)).toEqual(['t1:failed']);
    expect(loadNotifications('a.b').map((item) => item.id)).toEqual(['other:failed']);
  });

  it('survives a storage that throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadNotifications('org')).toEqual([]);
  });
});
