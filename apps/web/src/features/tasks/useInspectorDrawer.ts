import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

/** Drawer state for the inspector on narrow screens: focus moves in on open, Escape closes and returns focus. */
export function useInspectorDrawer() {
  const [isOpen, setOpen] = useState(false);
  const openerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  const close = () => {
    setOpen(false);
    openerRef.current?.querySelector('button')?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) close();
  };

  return { isOpen, open: () => setOpen(true), close, onKeyDown, openerRef, panelRef };
}
