import { SEARCH_LIMITS } from '@fleet/shared';
import { Search } from 'lucide-react';
import { type FocusEvent, type RefObject, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { buildSearchGroups, currentPlatform, resultCountLabel, type SearchOption, shortcutLabel } from './searchModel';
import { SearchResults } from './SearchResults';
import { useGlobalSearch } from './useGlobalSearch';
import { useSearchCombobox } from './useSearchCombobox';

interface SearchComboboxProps {
  inputRef: RefObject<HTMLInputElement | null>;
  /** The search was left (navigation, second Escape or focus moved away). */
  onDismiss: () => void;
}

function popupMessage(isLoading: boolean, error: unknown, count: number): string {
  if (error) return 'No se pudo completar la búsqueda.';
  if (count > 0) return '';
  return isLoading ? 'Buscando…' : resultCountLabel(0);
}

/** Global search of the masthead: an editable combobox listing projects, tasks and agents. */
export function SearchCombobox({ inputRef, onDismiss }: SearchComboboxProps) {
  const navigate = useNavigate();
  const listboxId = useId();
  const [kbd] = useState(() => shortcutLabel(currentPlatform()));
  const [query, setQuery] = useState('');
  const search = useGlobalSearch(query);
  const groups = useMemo(() => buildSearchGroups(search.results), [search.results]);
  const options = useMemo(() => groups.flatMap((group) => group.options), [groups]);

  const leave = () => {
    inputRef.current?.blur();
    onDismiss();
  };
  const combobox = useSearchCombobox<SearchOption>({
    query,
    onQueryChange: setQuery,
    options,
    onPick: (option) => {
      navigate(option.href);
      leave();
    },
    onDismiss: leave,
  });

  const optionId = (option: SearchOption) => `${listboxId}-${option.key}`;
  const activeOption = options[combobox.activeIndex];
  const activeId = activeOption ? optionId(activeOption) : undefined;
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const message = popupMessage(search.isLoading, search.error, options.length);
  const announcement = combobox.isPopupShown && !search.isLoading ? message || resultCountLabel(options.length) : '';

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    combobox.close();
    onDismiss();
  };

  return (
    <div className="relative" onBlur={onBlur}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Buscar proyectos, tareas y agentes"
        aria-expanded={combobox.isExpanded}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-keyshortcuts="Meta+K Control+K"
        autoComplete="off"
        spellCheck={false}
        maxLength={SEARCH_LIMITS.queryLength}
        placeholder="Buscar proyecto, tarea o agente…"
        value={query}
        onChange={(event) => combobox.setQuery(event.target.value)}
        onFocus={combobox.open}
        onKeyDown={combobox.onKeyDown}
        className="h-8 w-full rounded-sm border border-line-strong bg-surface pr-14 pl-8 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus-visible:ring-1 focus-visible:ring-accent lg:w-64"
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-line-strong bg-surface-raised px-1 font-mono text-[0.6875rem] text-fg-subtle"
      >
        {kbd}
      </kbd>
      <div
        hidden={!combobox.isPopupShown}
        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-[min(24rem,70dvh)] overflow-y-auto rounded-sm border border-line bg-surface-raised shadow-float lg:left-auto lg:w-[28rem] lg:max-w-[calc(100vw-1rem)]"
      >
        <SearchResults
          id={listboxId}
          groups={groups}
          hidden={!combobox.isExpanded}
          activeKey={activeOption?.key}
          optionId={optionId}
          onHover={(option) => combobox.setActiveIndex(options.indexOf(option))}
          onPick={combobox.pick}
        />
        {message && <p className="px-3 py-2 text-sm text-fg-subtle">{message}</p>}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
