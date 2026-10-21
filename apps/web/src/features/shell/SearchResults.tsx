import { Bot, FolderKanban, ListTodo } from 'lucide-react';
import { Badge } from '../../components/ui';
import { TaskStatusBadge } from '../tasks/TaskStatusBadge';
import type { SearchGroup, SearchKind, SearchOption } from './searchModel';

const KIND_ICONS: Record<SearchKind, typeof Bot> = { project: FolderKanban, task: ListTodo, agent: Bot };

interface SearchResultsProps {
  id: string;
  groups: SearchGroup[];
  hidden: boolean;
  activeKey: string | undefined;
  optionId: (option: SearchOption) => string;
  onHover: (option: SearchOption) => void;
  onPick: (option: SearchOption) => void;
}

function OptionContent({ option }: { option: SearchOption }) {
  switch (option.kind) {
    case 'project':
      return (
        <>
          <span className="min-w-0 flex-1 truncate">{option.hit.name}</span>
          {option.hit.archived && <Badge>Archivado</Badge>}
        </>
      );
    case 'task':
      return (
        <>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-mono text-xs text-fg-subtle">Tarea {option.hit.number}</span> · {option.hit.title}{' '}
            <span className="text-fg-subtle">· {option.hit.projectName}</span>
          </span>
          <TaskStatusBadge status={option.hit.status} />
        </>
      );
    case 'agent':
      return (
        <>
          <span className="min-w-0 flex-1 truncate">{option.hit.name}</span>
          <span className="max-w-[40%] truncate text-xs text-fg-subtle">{option.hit.role}</span>
        </>
      );
  }
}

/** Listbox of the search combobox: one labelled group per kind. Options never take focus. */
export function SearchResults({ id, groups, hidden, activeKey, optionId, onHover, onPick }: SearchResultsProps) {
  return (
    <div id={id} role="listbox" aria-label="Resultados de búsqueda" hidden={hidden} className="py-1">
      {groups.map((group) => {
        const Icon = KIND_ICONS[group.kind];
        const labelId = `${id}-${group.kind}`;
        return (
          <div key={group.kind} role="group" aria-labelledby={labelId}>
            <div id={labelId} role="presentation" className="label-mono px-3 pt-2 pb-1 text-fg-subtle">
              {group.label}
            </div>
            {group.options.map((option) => {
              const isActive = option.key === activeKey;
              return (
                <div
                  key={option.key}
                  id={optionId(option)}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => onHover(option)}
                  onClick={() => onPick(option)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${isActive ? 'bg-surface-hover text-fg' : 'text-fg-muted'}`}
                >
                  <Icon aria-hidden className={`size-4 shrink-0 ${isActive ? 'text-accent' : 'text-fg-subtle'}`} />
                  <OptionContent option={option} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
