import { describe, expect, it } from 'vitest';
import { ToolTimeTracker, unionDurationMs } from '../../src/application/metrics/toolTiming.js';

describe('unionDurationMs', () => {
  it('sums disjoint intervals', () => {
    expect(
      unionDurationMs([
        { startMs: 0, endMs: 10 },
        { startMs: 20, endMs: 25 },
      ]),
    ).toBe(15);
  });

  it('counts overlapping intervals once', () => {
    expect(
      unionDurationMs([
        { startMs: 0, endMs: 10 },
        { startMs: 5, endMs: 20 },
      ]),
    ).toBe(20);
  });

  it('ignores intervals nested in another one', () => {
    expect(
      unionDurationMs([
        { startMs: 0, endMs: 100 },
        { startMs: 10, endMs: 20 },
        { startMs: 30, endMs: 40 },
      ]),
    ).toBe(100);
  });

  it('is zero without intervals or with empty and reversed ones', () => {
    expect(unionDurationMs([])).toBe(0);
    expect(
      unionDurationMs([
        { startMs: 5, endMs: 5 },
        { startMs: 9, endMs: 3 },
      ]),
    ).toBe(0);
  });
});

describe('ToolTimeTracker', () => {
  it('measures from each call to its matching result, overlaps once', () => {
    const tracker = new ToolTimeTracker();
    tracker.start('a', 0);
    tracker.start('b', 4);
    tracker.finish('a', 10);
    tracker.finish('b', 16);

    expect(tracker.totalMs(100)).toBe(16);
  });

  it('closes calls without a result when the run ends', () => {
    const tracker = new ToolTimeTracker();
    tracker.start('a', 0);
    tracker.finish('a', 5);
    tracker.start('lost', 50);

    expect(tracker.totalMs(80)).toBe(35);
  });

  it('ignores results that match no call and repeated starts', () => {
    const tracker = new ToolTimeTracker();
    tracker.finish('ghost', 5);
    tracker.start('a', 10);
    tracker.start('a', 12);
    tracker.finish('a', 20);

    expect(tracker.totalMs(30)).toBe(10);
  });
});
