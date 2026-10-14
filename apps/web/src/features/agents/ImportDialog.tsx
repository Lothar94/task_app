import type { AgentDto, AgentImportConflictStrategy, AgentImportResultDto } from '@fleet/shared';
import { useRef, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { findNameConflicts, readImportFile, type ParsedImport } from './agentImport';
import { useImportAgents } from './agentQueries';
import { ImportDialogView } from './ImportDialogView';

export function ImportDialog({
  open,
  existingAgents,
  onClose,
}: {
  open: boolean;
  existingAgents: AgentDto[];
  onClose: () => void;
}) {
  const importAgents = useImportAgents();
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [strategy, setStrategy] = useState<AgentImportConflictStrategy>('fail');
  const [result, setResult] = useState<AgentImportResultDto | null>(null);

  const file = parsed?.ok ? parsed.file : null;
  const conflicts = file
    ? findNameConflicts(
        file,
        existingAgents.map((agent) => agent.name),
      )
    : [];

  const close = () => {
    setParsed(null);
    setStrategy('fail');
    setResult(null);
    importAgents.reset();
    onClose();
  };

  const latestSelection = useRef(0);

  const handleFile = async (selected: File | undefined) => {
    const selection = ++latestSelection.current;
    importAgents.reset();
    if (!selected) return setParsed(null);
    const next = await readImportFile(selected);
    if (selection === latestSelection.current) setParsed(next);
  };

  const submit = () => {
    if (!file) return;
    importAgents.mutate(
      { file, onConflict: conflicts.length > 0 ? strategy : undefined },
      { onSuccess: setResult },
    );
  };

  return (
    <Dialog open={open} title="Importar agentes" onClose={close}>
      <ImportDialogView
        parsed={parsed}
        conflicts={conflicts}
        strategy={strategy}
        isPending={importAgents.isPending}
        error={importAgents.error}
        result={result}
        onFileChange={handleFile}
        onStrategyChange={setStrategy}
        onSubmit={submit}
        onClose={close}
      />
    </Dialog>
  );
}
