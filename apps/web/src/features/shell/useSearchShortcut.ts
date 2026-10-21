import { useEffect, useRef } from 'react';
import { isSearchShortcut } from './searchModel';

/** Runs `onTrigger` on ⌘K / Ctrl+K from anywhere in the page, overriding the browser's own binding. */
export function useSearchShortcut(onTrigger: () => void): void {
  const handlerRef = useRef(onTrigger);
  handlerRef.current = onTrigger;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) return;
      event.preventDefault();
      handlerRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
