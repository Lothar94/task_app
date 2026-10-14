import { useState } from 'react';
import { useExportAgents } from './agentQueries';

/** Selection mode for exporting agents; `selected === null` means not selecting. */
export function useAgentExportSelection(enabled: boolean) {
  const exportAgents = useExportAgents();
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [includeCollaborators, setIncludeCollaborators] = useState(false);

  const selected = enabled ? selection : null;

  const cancel = () => {
    setSelection(null);
    exportAgents.reset();
  };

  return {
    selected,
    includeCollaborators,
    setIncludeCollaborators,
    isPending: exportAgents.isPending,
    error: exportAgents.error,
    start: () => setSelection(new Set()),
    cancel,
    selectAll: (ids: string[]) => setSelection(new Set(ids)),
    selectNone: () => setSelection(new Set()),
    toggle: (id: string) =>
      setSelection((current) => {
        const next = new Set(current);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    exportSelected: () =>
      selected &&
      exportAgents.mutate({ agentIds: [...selected], includeCollaborators }, { onSuccess: cancel }),
    exportAll: () => exportAgents.mutate({}),
  };
}
