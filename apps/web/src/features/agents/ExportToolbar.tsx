import { Button, ErrorMessage } from '../../components/ui';

interface ExportToolbarProps {
  selectedCount: number;
  includeCollaborators: boolean;
  isPending: boolean;
  error: unknown;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onIncludeCollaboratorsChange: (include: boolean) => void;
  onExport: () => void;
  onCancel: () => void;
}

export function ExportToolbar({
  selectedCount,
  includeCollaborators,
  isPending,
  error,
  onSelectAll,
  onSelectNone,
  onIncludeCollaboratorsChange,
  onExport,
  onCancel,
}: ExportToolbarProps) {
  return (
    <section
      aria-label="Exportar agentes"
      className="mb-4 space-y-3 rounded-lg border border-indigo-500/40 bg-zinc-900/60 p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onSelectAll}>
          Seleccionar todos
        </Button>
        <Button variant="secondary" onClick={onSelectNone}>
          Ninguno
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeCollaborators}
            onChange={(event) => onIncludeCollaboratorsChange(event.target.checked)}
          />
          Incluir colaboradores
        </label>
        <div className="ml-auto flex gap-2">
          <Button onClick={onExport} disabled={selectedCount === 0 || isPending}>
            {isPending ? 'Exportando…' : `Exportar selección (${selectedCount})`}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
      <ErrorMessage error={error} />
    </section>
  );
}
