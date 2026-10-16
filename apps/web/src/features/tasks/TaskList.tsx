import type { TaskNodeDto } from '@fleet/shared';
import { useState } from 'react';
import { EmptyState, Field, Select } from '../../components/ui';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import {
  ALL_TAGS,
  awaitsConfirmation,
  buildTaskList,
  existingTags,
  GROUP_OPTIONS,
  type GroupBy,
  SORT_OPTIONS,
  type SortBy,
} from './taskListModel';
import { TaskTree } from './TaskTree';

const GROUP_VALUES = GROUP_OPTIONS.map((option) => option.value);
const SORT_VALUES = SORT_OPTIONS.map((option) => option.value);

interface TaskListProps {
  projectId: string;
  roots: TaskNodeDto[];
  agentNames: Map<string, string>;
}

/** Root tasks of a project with persisted grouping, sorting and tag filter. */
export function TaskList({ projectId, roots, agentNames }: TaskListProps) {
  const [groupBy, setGroupBy] = useStoredChoice<GroupBy>('fleet.tasks.groupBy', GROUP_VALUES, 'none');
  const [sortBy, setSortBy] = useStoredChoice<SortBy>('fleet.tasks.sortBy', SORT_VALUES, 'number');
  const tags = existingTags(roots);
  const [storedTag, setTagFilter] = useStoredChoice<string>('fleet.tasks.tag', [ALL_TAGS, ...tags], ALL_TAGS);
  // The remembered tag may no longer exist in this project: fall back to showing everything.
  const tagFilter = tags.includes(storedTag) ? storedTag : ALL_TAGS;
  const [proposalsOnly, setProposalsOnly] = useState(false);
  const proposalCount = roots.filter(awaitsConfirmation).length;
  const onlyProposals = proposalsOnly && proposalCount > 0;
  const groups = buildTaskList(roots, { groupBy, sortBy, tag: tagFilter, proposalsOnly: onlyProposals });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Agrupar por">
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
            {GROUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ordenar por">
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        {tags.length > 0 && (
          <Field label="Filtrar por tag">
            <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value={ALL_TAGS}>Todos</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {proposalCount > 0 && (
          <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={onlyProposals}
              onChange={(e) => setProposalsOnly(e.target.checked)}
            />
            Propuestas por agentes pendientes de confirmación ({proposalCount})
          </label>
        )}
      </div>
      {groups.length === 0 ? (
        roots.length === 0 ? (
          <TaskTree projectId={projectId} nodes={[]} agentNames={agentNames} />
        ) : (
          <EmptyState>Ninguna tarea coincide con los filtros.</EmptyState>
        )
      ) : (
        groups.map((group, index) => (
          <section key={group.key} aria-label={group.label ?? undefined}>
            {group.label && (
              <h3 className="mb-1 text-sm font-semibold text-zinc-300">
                {group.label} <span className="font-normal text-zinc-500">({group.nodes.length})</span>
              </h3>
            )}
            <TaskTree
              projectId={projectId}
              nodes={group.nodes}
              agentNames={agentNames}
              keepOrder
              hideHeader={index > 0}
            />
          </section>
        ))
      )}
    </div>
  );
}
