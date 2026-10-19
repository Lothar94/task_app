import { describe, expect, it } from 'vitest';
import { isNearBottom } from './stickToBottom';

const metrics = (scrollTop: number) => ({ scrollHeight: 1000, clientHeight: 400, scrollTop });

describe('isNearBottom', () => {
  it('is true at the very end', () => {
    expect(isNearBottom(metrics(600))).toBe(true);
  });

  it('tolerates a few pixels of slack', () => {
    expect(isNearBottom(metrics(560))).toBe(true);
  });

  it('is false once the user scrolled up past the threshold', () => {
    expect(isNearBottom(metrics(500))).toBe(false);
  });

  it('is true when the content fits without scrolling', () => {
    expect(isNearBottom({ scrollHeight: 300, clientHeight: 400, scrollTop: 0 })).toBe(true);
  });

  it('accepts a custom threshold', () => {
    expect(isNearBottom(metrics(500), 100)).toBe(true);
  });
});
