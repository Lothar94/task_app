import type { AgentDto } from '@fleet/shared';
import { useState } from 'react';
import { ApiError } from '../../api/httpClient';
import { useAgentRuntime, useSetAgentEnabled, useUpdateAgent } from './agentQueries';
import {
  isSheetDirty,
  maxOutputTokensError,
  type SheetEdits,
  type SheetField,
  type SheetValues,
  sheetValuesOf,
  splitValidationDetails,
  toSheetAgentInput,
} from './agentSheetForm';

const disableQuestion = (name: string) =>
  `¿Desactivar a ${name}? No recibirá tareas nuevas; las que ya tiene asignadas siguen su curso.`;

/**
 * Edits of the agent sheet as overrides on top of the agent, so an untouched field always shows
 * the latest agent. Mount it per agent (`key`) so switching agent starts clean.
 */
export function useAgentSheetForm(agent: AgentDto) {
  const runtime = useAgentRuntime();
  const update = useUpdateAgent();
  const enabled = useSetAgentEnabled();
  const [edits, setEdits] = useState<SheetEdits>({});
  const [notice, setNotice] = useState('');

  const values: SheetValues = { ...sheetValuesOf(agent), ...edits };
  const isDirty = isSheetDirty(agent, values);
  const tokensError = maxOutputTokensError(values.maxOutputTokens);
  const serverErrors = splitValidationDetails(update.error instanceof ApiError ? update.error.details : []);
  // Field details are shown inline; the form-level alert keeps the message and the rest.
  const formError =
    update.error instanceof ApiError
      ? new ApiError(update.error.message, update.error.status, serverErrors.general)
      : update.error;

  const setField = <F extends SheetField>(field: F, value: SheetValues[F]) => {
    setEdits((current) => ({ ...current, [field]: value }));
    setNotice('');
    update.reset();
  };

  const save = () =>
    update.mutate(
      { id: agent.id, input: toSheetAgentInput(agent, values, runtime.data?.supports) },
      {
        onSuccess: () => {
          setEdits({});
          setNotice('Cambios guardados.');
        },
      },
    );

  const setAgentEnabled = (next: boolean) => {
    if (!next && !window.confirm(disableQuestion(agent.name))) return;
    setNotice('');
    enabled.mutate(
      { id: agent.id, enabled: next },
      { onSuccess: (saved) => setNotice(saved.enabled ? 'Agente activado.' : 'Agente desactivado.') },
    );
  };

  return {
    values,
    setField,
    runtime,
    isDirty,
    canSave: isDirty && tokensError === null && !update.isPending,
    isSaving: update.isPending,
    save,
    formError,
    fieldErrors: tokensError
      ? { ...serverErrors.byField, maxOutputTokens: tokensError }
      : serverErrors.byField,
    setAgentEnabled,
    isTogglingEnabled: enabled.isPending,
    enabledError: enabled.error,
    notice,
  };
}

export type AgentSheetForm = ReturnType<typeof useAgentSheetForm>;
