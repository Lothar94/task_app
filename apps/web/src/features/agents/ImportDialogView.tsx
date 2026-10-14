import type { AgentImportConflictStrategy, AgentImportResultDto } from '@fleet/shared';
import { useEffect, useRef } from 'react';
import { Button, ErrorMessage, Field, Select } from '../../components/ui';
import type { ParsedImport } from './agentImport';

export const STRATEGY_LABELS: Record<AgentImportConflictStrategy, string> = {
  fail: 'Cancelar si hay conflicto',
  skip: 'Omitir existentes',
  rename: 'Renombrar',
};

export interface ImportDialogViewProps {
  parsed: ParsedImport | null;
  conflicts: string[];
  strategy: AgentImportConflictStrategy;
  isPending: boolean;
  error: unknown;
  result: AgentImportResultDto | null;
  onFileChange: (file: File | undefined) => void;
  onStrategyChange: (strategy: AgentImportConflictStrategy) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function Preview({
  file,
  conflicts,
}: {
  file: Extract<ParsedImport, { ok: true }>['file'];
  conflicts: string[];
}) {
  return (
    <section aria-label="Vista previa" className="space-y-2 text-sm">
      <p>
        {file.agents.length} {file.agents.length === 1 ? 'agente' : 'agentes'} · organización de origen:{' '}
        <strong>{file.organization}</strong>
      </p>
      <ul className="max-h-48 list-disc overflow-auto pl-5">
        {file.agents.map((agent, index) => (
          <li key={`${agent.name}-${index}`}>
            {agent.name}
            {conflicts.includes(agent.name) && <span className="text-amber-400"> (ya existe)</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ImportResult({ result }: { result: AgentImportResultDto }) {
  return (
    <div aria-live="polite" className="space-y-2 text-sm">
      <p>
        Importados: {result.imported.length} · Omitidos: {result.skipped.length} · Renombrados:{' '}
        {result.renamed.length}
      </p>
      {result.skipped.length > 0 && <p>Omitidos: {result.skipped.join(', ')}</p>}
      {result.renamed.length > 0 && (
        <ul className="list-disc pl-5">
          {result.renamed.map(({ from, to }) => (
            <li key={`${from}-${to}`}>
              {from} → {to}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ParseError({ parsed }: { parsed: ParsedImport | null }) {
  return (
    <div aria-live="polite">{parsed && !parsed.ok && <ErrorMessage error={new Error(parsed.error)} />}</div>
  );
}

function ImportDone({ result, onClose }: { result: AgentImportResultDto; onClose: () => void }) {
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => summaryRef.current?.focus(), []);
  return (
    <div ref={summaryRef} tabIndex={-1} className="space-y-4 outline-none">
      <ImportResult result={result} />
      <div className="flex justify-end">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

function StrategyField({
  conflictCount,
  strategy,
  onChange,
}: {
  conflictCount: number;
  strategy: AgentImportConflictStrategy;
  onChange: (strategy: AgentImportConflictStrategy) => void;
}) {
  return (
    <Field
      label="Si un nombre ya existe"
      hint={`${conflictCount} ${conflictCount === 1 ? 'conflicto' : 'conflictos'} con agentes existentes.`}
    >
      <Select
        value={strategy}
        onChange={(event) => onChange(event.target.value as AgentImportConflictStrategy)}
      >
        {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function ImportDialogView(props: ImportDialogViewProps) {
  const { parsed, conflicts, strategy, isPending, error, result } = props;
  if (result) return <ImportDone result={result} onClose={props.onClose} />;
  const file = parsed?.ok ? parsed.file : null;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <Field label="Fichero de exportación" hint="JSON generado con «Exportar».">
        <input
          type="file"
          accept=".json,application/json"
          className="block w-full text-sm"
          onChange={(event) => props.onFileChange(event.target.files?.[0])}
        />
      </Field>
      <ParseError parsed={parsed} />
      {file && <Preview file={file} conflicts={conflicts} />}
      {file && conflicts.length > 0 && (
        <StrategyField
          conflictCount={conflicts.length}
          strategy={strategy}
          onChange={props.onStrategyChange}
        />
      )}
      <ErrorMessage error={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={props.onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!file || isPending}>
          {isPending ? 'Importando…' : 'Importar'}
        </Button>
      </div>
    </form>
  );
}
