import { type KeyboardEvent, useState } from 'react';
import { isNavigationKey, moveActiveIndex, type NavigationKey } from './searchModel';

interface ComboboxOptions<T> {
  query: string;
  onQueryChange: (query: string) => void;
  options: T[];
  onPick: (option: T) => void;
  /** Second Escape: the query is cleared and the search left. */
  onDismiss: () => void;
}

/** State and keyboard behaviour of the search combobox (WAI-ARIA 1.2, list autocomplete). */
export function useSearchCombobox<T>({ query, onQueryChange, options, onPick, onDismiss }: ComboboxOptions<T>) {
  const [isOpen, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const isPopupShown = isOpen && query.trim() !== '';
  const isExpanded = isPopupShown && options.length > 0;
  const currentIndex = isExpanded ? Math.min(activeIndex, options.length - 1) : -1;
  const activeOption = currentIndex >= 0 ? options[currentIndex] : undefined;

  const setQuery = (next: string) => {
    onQueryChange(next);
    setOpen(true);
    setActiveIndex(0);
  };

  const reset = () => {
    onQueryChange('');
    setOpen(false);
    setActiveIndex(0);
  };

  const pick = (option: T) => {
    reset();
    onPick(option);
  };

  const move = (key: NavigationKey) => {
    if (!isExpanded) {
      setOpen(true);
      return;
    }
    setActiveIndex(moveActiveIndex(currentIndex, options.length, key));
  };

  const escape = () => {
    if (isPopupShown) {
      setOpen(false);
      return;
    }
    reset();
    onDismiss();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;
    // Home/End keep moving the caret while there is no list to move through.
    if (isNavigationKey(key) && (isExpanded || key === 'ArrowDown' || key === 'ArrowUp')) move(key);
    else if (key === 'Enter' && activeOption !== undefined) pick(activeOption);
    else if (key === 'Escape') escape();
    else return;
    event.preventDefault();
  };

  return {
    setQuery,
    isPopupShown,
    isExpanded,
    activeIndex: currentIndex,
    setActiveIndex,
    open: () => setOpen(true),
    close: () => setOpen(false),
    pick,
    onKeyDown,
  };
}
