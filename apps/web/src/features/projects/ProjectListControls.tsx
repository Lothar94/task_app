import { Search } from 'lucide-react';
import { Select, TextInput } from '../../components/ui';
import { PROJECT_SORT_LABELS, type ProjectSort } from './projectListModel';

/** Name/path filter and sort selector of the projects list. */
export function ProjectListControls({
  query,
  onQueryChange,
  sort,
  onSortChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  sort: ProjectSort;
  onSortChange: (sort: ProjectSort) => void;
}) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
      <div className="relative min-w-48 flex-1 sm:max-w-72">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle"
        />
        <TextInput
          type="search"
          aria-label="Filtrar por nombre o ruta"
          placeholder="Filtrar por nombre o ruta"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          style={{ paddingLeft: '2rem' }}
        />
      </div>
      <div className="w-36">
        <Select
          aria-label="Ordenar por"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ProjectSort)}
        >
          {(Object.keys(PROJECT_SORT_LABELS) as ProjectSort[]).map((value) => (
            <option key={value} value={value}>
              {PROJECT_SORT_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
