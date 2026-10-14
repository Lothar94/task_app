import type { AgentDto } from '@fleet/shared';
import { useState } from 'react';
import { Button } from '../../components/ui';
import { ImportDialog } from './ImportDialog';

export function ImportButton({
  existingAgents,
  disabled,
}: {
  existingAgents: AgentDto[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
        Importar
      </Button>
      <ImportDialog open={open} existingAgents={existingAgents} onClose={() => setOpen(false)} />
    </>
  );
}
