interface Interval {
  startMs: number;
  endMs: number;
}

/**
 * Measures how long tools were running during a run: from each tool call to its result.
 * Overlapping calls (parallel tools, delegated subtasks) count once; calls without a result
 * are closed when the run ends.
 */
export class ToolTimeTracker {
  private readonly open = new Map<string, number>();
  private readonly closed: Interval[] = [];

  start(toolUseId: string, atMs: number): void {
    if (!this.open.has(toolUseId)) this.open.set(toolUseId, atMs);
  }

  finish(toolUseId: string, atMs: number): void {
    const startMs = this.open.get(toolUseId);
    if (startMs === undefined) return;
    this.open.delete(toolUseId);
    this.closed.push({ startMs, endMs: atMs });
  }

  totalMs(runEndMs: number): number {
    const unfinished = [...this.open.values()].map((startMs) => ({ startMs, endMs: runEndMs }));
    return unionDurationMs([...this.closed, ...unfinished]);
  }
}

/** Total length covered by the intervals, counting overlaps once. Negative intervals count as empty. */
export function unionDurationMs(intervals: readonly Interval[]): number {
  const sorted = intervals
    .filter(({ startMs, endMs }) => endMs > startMs)
    .sort((a, b) => a.startMs - b.startMs);
  let total = 0;
  let coveredUntil = -Infinity;
  for (const { startMs, endMs } of sorted) {
    if (endMs <= coveredUntil) continue;
    total += endMs - Math.max(startMs, coveredUntil);
    coveredUntil = endMs;
  }
  return total;
}
