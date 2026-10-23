/** Manual zoom levels of the diagram; "encajar" may go below the minimum to fit a wide fleet. */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]!;
const EPSILON = 0.001;

export const zoomInFrom = (scale: number) => ZOOM_STEPS.find((step) => step > scale + EPSILON) ?? MAX_ZOOM;

export const zoomOutFrom = (scale: number) =>
  [...ZOOM_STEPS].reverse().find((step) => step < scale - EPSILON) ?? MIN_ZOOM;

/** Scale that makes the diagram as wide as its container, never enlarging it; 1 until the width is known. */
export const fitScale = (containerWidth: number, contentWidth: number) =>
  containerWidth > 0 && contentWidth > 0 ? Math.min(1, containerWidth / contentWidth) : 1;

export const zoomPercent = (scale: number) => `${Math.round(scale * 100)}%`;
