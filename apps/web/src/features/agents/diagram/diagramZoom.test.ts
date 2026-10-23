import { describe, expect, it } from 'vitest';
import { fitScale, MAX_ZOOM, MIN_ZOOM, zoomInFrom, zoomOutFrom, zoomPercent } from './diagramZoom';

describe('diagram zoom', () => {
  it('steps between 50% and 200%', () => {
    expect(zoomInFrom(1)).toBe(1.25);
    expect(zoomInFrom(0.62)).toBe(0.75);
    expect(zoomInFrom(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(zoomOutFrom(1)).toBe(0.75);
    expect(zoomOutFrom(0.3)).toBe(MIN_ZOOM);
  });

  it('fits the container width without enlarging', () => {
    expect(fitScale(500, 1000)).toBe(0.5);
    expect(fitScale(2000, 1000)).toBe(1);
    expect(fitScale(0, 1000)).toBe(1);
  });

  it('formats the percentage', () => {
    expect(zoomPercent(0.756)).toBe('76%');
  });
});
