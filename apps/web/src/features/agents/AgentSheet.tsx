import type { AgentDto } from '@fleet/shared';
import { Check, X } from 'lucide-react';
import { forwardRef } from 'react';
import { FOCUS_RING, LinkButton, StatusChip } from '../../components/ui';
import { formatInteger, formatPercent } from '../../lib/format';
import { EFFORT_LABELS, modelText } from './agentLabels';
import { AgentAvatar } from './AgentAvatar';
import { type AgentTrackRecord, isOrchestrator } from './agentSheetModel';

interface AgentSheetProps {
  agent: AgentDto;
  record?: AgentTrackRecord;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h3 className="label-mono mb-2 text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

function CheckRows({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center justify-between gap-2 border border-line bg-surface-raised px-2.5 py-1.5 font-mono text-xs text-fg"
        >
          <span className="truncate">{item}</span>
          <Check aria-label="Habilitada" role="img" className="size-4 shrink-0 text-accent" />
        </li>
      ))}
    </ul>
  );
}

/** Read-only agent card, fixed to the right edge; editing happens in the existing editor. */
export const AgentSheet = forwardRef<HTMLElement, AgentSheetProps>(function AgentSheet(
  { agent, record, onClose },
  ref,
) {
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
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="border border-line bg-surface p-3.5">
          <div className="flex items-center gap-3">
            <AgentAvatar name={agent.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-semibold text-fg">{agent.name}</p>
                {isOrchestrator(agent) && <StatusChip tone="info">Orquestador</StatusChip>}
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
        <Section title="Directiva base">
          <pre
            tabIndex={0}
            aria-label="Directiva base del agente"
            className={`max-h-56 overflow-y-auto border border-line bg-surface p-2.5 font-mono text-xs whitespace-pre-wrap text-fg ${FOCUS_RING}`}
          >
            {agent.instructions || 'Sin instrucciones.'}
          </pre>
        </Section>
        <Section title="Modelo asignado">
          <p className="border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-fg">
            {modelText(agent)}
          </p>
          <p className="mt-2 font-mono text-xs text-fg-subtle">
            Esfuerzo: <span className="text-fg">{EFFORT_LABELS[agent.effort]}</span>
          </p>
        </Section>
        {agent.allowedTools.length > 0 && (
          <Section title="Herramientas">
            <CheckRows items={agent.allowedTools} />
          </Section>
        )}
        {agent.skills.length > 0 && (
          <Section title="Skills">
            <CheckRows items={agent.skills} />
          </Section>
        )}
      </div>
      <footer className="border-t border-line bg-surface p-4">
        <LinkButton to={`/agents/${agent.id}/edit`}>Editar</LinkButton>
      </footer>
    </aside>
  );
});
