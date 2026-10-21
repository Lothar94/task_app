import { Search } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { IconButton } from '../../components/ui';
import { SearchCombobox } from './SearchCombobox';
import { useSearchShortcut } from './useSearchShortcut';

/**
 * Masthead search. Wide screens show the combobox inline; narrow ones a button that unfolds it
 * as a full-width panel under the masthead. ⌘K / Ctrl+K focuses it in both cases.
 */
export function GlobalSearch() {
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);

  const openSearch = useCallback(() => {
    // The panel must be visible before its input can take focus.
    flushSync(() => setPanelOpen(true));
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  useSearchShortcut(openSearch);

  return (
    <>
      <IconButton
        label="Buscar"
        aria-expanded={isPanelOpen}
        aria-controls={panelId}
        // Keeps focus in the input so its blur does not close the panel before the toggle runs.
        onMouseDown={(event) => event.preventDefault()}
        onClick={isPanelOpen ? () => setPanelOpen(false) : openSearch}
        className="size-8 lg:hidden"
      >
        <Search aria-hidden className="size-[18px]" />
      </IconButton>
      <div
        id={panelId}
        className={`${isPanelOpen ? 'absolute inset-x-0 top-full z-50 border-b border-line bg-canvas p-2' : 'hidden'} lg:relative lg:inset-auto lg:block lg:border-0 lg:bg-transparent lg:p-0`}
      >
        <SearchCombobox inputRef={inputRef} onDismiss={() => setPanelOpen(false)} />
      </div>
    </>
  );
}
