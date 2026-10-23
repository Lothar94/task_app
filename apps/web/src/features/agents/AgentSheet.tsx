import type { AgentDto } from '@fleet/shared';
import { Power, Save, X } from 'lucide-react';
import { forwardRef } from 'react';
import { Button, ErrorMessage, FOCUS_RING, LinkButton, StatusChip } from '../../components/ui';
import { formatInteger, formatPercent } from '../../lib/format';
import { AgentAvatar } from './AgentAvatar';
import { AgentSheetFields } from './AgentSheetFields';
import { type AgentTrackRecord, isOrchestrator } from './agentSheetModel';
import { type AgentSheetForm, useAgentSheetForm } from './useAgentSheetForm';

interface AgentSheetProps {
  agent: AgentDto;
  record?: AgentTrackRecord;
  onClose: () => void;
}

function ProfileCard({ agent, record }: { agent: AgentDto; record?: AgentTrackRecord }) {
  return (
    <div className="border border-line bg-surface p-3.5">
      <div className="flex items-center gap-3">
        <AgentAvatar name={agent.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-base font-semibold text-fg">{agent.name}</p>
            <div className="flex shrink-0 gap-1">
              {agent.enabled === false && <StatusChip tone="neutral">Desactivado</StatusChip>}
              {isOrchestrator(agent) && <StatusChip tone="info">Orquestador</StatusChip>}
            </div>
          </div>
          <p className="truncate font-mono text-xs text-fg-subtle">{agent.role}</p>
        </div>
      </div>
      {record && (
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-2 font-mono text-xs">
          <div>
            <dt className="text-fg-subtle">Tareas resueltas</dt>
            <dd className="font-medium text-fg">{formatInteger(record.completed)}</dd>
          </div>
          <div>
            <dt className="text-fg-subtle">Tasa de fallo</dt>
            <dd className="font-medium text-fg">{formatPercent(record.failRate)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function SheetFooter({ agent, form }: { agent: AgentDto; form: AgentSheetForm }) {
  const isEnabled = agent.enabled !== false;
  return (
    <footer className="space-y-3 border-t border-line bg-surface p-4">
      <ErrorMessage error={form.formError ?? form.enabledError} />
      <p role="status" aria-live="polite" className="text-xs text-success">
        {form.notice}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant={isEnabled ? 'danger' : 'secondary'}
          disabled={form.isTogglingEnabled}
          onClick={() => form.setAgentEnabled(!isEnabled)}
        >
          <Power aria-hidden className="size-4" />
          {isEnabled ? 'Desactivar' : 'Activar'}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton to={`/agents/${agent.id}/edit`} variant="secondary">
            Editor completo
          </LinkButton>
          <Button type="submit" disabled={!form.canSave}>
            <Save aria-hidden className="size-4" />
            {form.isSaving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </footer>
  );
}

/**
 * Agent card fixed to the right edge: track record plus the settings that can be changed in place.
 * Mount it with `key={agent.id}` so switching agent resets the form.
 */
export const AgentSheet = forwardRef<HTMLElement, AgentSheetProps>(function AgentSheet(
  { agent, record, onClose },
  ref,
) {
  const form = useAgentSheetForm(agent);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label="Ficha del agente"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-line bg-canvas outline-none"
    >
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <h2 className="text-base font-semibold text-fg">Ficha del agente</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ficha"
          className={`p-1 text-fg-subtle hover:bg-surface-hover hover:text-fg ${FOCUS_RING}`}
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>
      <form
        aria-label={`Configuración de ${agent.name}`}
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.canSave) form.save();
        }}
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <ProfileCard agent={agent} record={record} />
          {agent.skills.length > 0 && (
            <p className="font-mono text-xs text-fg-subtle">
              Skills: <span className="text-fg">{agent.skills.join(', ')}</span>
            </p>
          )}
          <AgentSheetFields agent={agent} form={form} />
        </div>
        <SheetFooter agent={agent} form={form} />
      </form>
    </aside>
  );
});
