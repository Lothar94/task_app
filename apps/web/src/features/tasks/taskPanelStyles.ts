import { FOCUS_RING } from '../../components/ui';

/** Independently scrolling panel: thin scrollbar, focusable by keyboard (pair with tabIndex=0 + aria-label). */
export const SCROLL_PANEL = `overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent] focus-visible:-outline-offset-2 ${FOCUS_RING}`;

export const anchorDomId = (id: string) => `task-anchor-${id}`;
