import type { DashboardDto, RunErrorCause, RunErrorRow } from '@fleet/shared';
import { Bug, Download } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, SegmentedControl, StatusChip } from '../../components/ui';
import { downloadCsv } from '../../lib/download';
import {
  causeSummary,
  countByCause,
  CAUSE_LABELS,
  errorsToCsv,
  filterByCause,
  periodLabel,
} from './dashboardModel';
import { ErrorList } from './ErrorList';
import { RetryTaskDialog } from './RetryTaskDialog';

const ALL = 'all';

/** "errores-2026-10-21.csv" */
const csvFileName = (now = new Date()) => `errores-${now.toISOString().slice(0, 10)}.csv`;

/** Error card: header total, cause diagnosis, cause filter, CSV export and the retry flow. */
export function ErrorsCard({
  errors,
  errorsTotal,
  errorCauses,
  days,
}: Pick<DashboardDto, 'errors' | 'errorsTotal' | 'errorCauses'> & { days: number | null }) {
  const [cause, setCause] = useState<RunErrorCause | typeof ALL>(ALL);
  const [retrying, setRetrying] = useState<RunErrorRow | null>(null);
  const listedCauses = countByCause(errors);
  // A cause that left the list after a refresh must not leave the filter stuck on an empty selection.
  const selected = listedCauses.some((entry) => entry.cause === cause) ? (cause as RunErrorCause) : null;
  const visible = filterByCause(errors, selected);

  return (
    <Card
      title={`Errores (${errorsTotal})`}
      icon={<Bug />}
      meta={<StatusChip tone="danger">{periodLabel(days)}</StatusChip>}
      actions={
        <Button
          variant="secondary"
          disabled={visible.length === 0}
          onClick={() => downloadCsv(csvFileName(), errorsToCsv(visible))}
        >
          <Download aria-hidden className="size-3.5" />
          Exportar
        </Button>
      }
    >
      <div className="space-y-3">
        {errorCauses.length > 0 && (
          <p className="text-sm text-fg-muted">
            <span className="font-medium text-fg">Diagnóstico:</span> {causeSummary(errorCauses)}
          </p>
        )}
        {listedCauses.length > 1 && (
          <div className="overflow-x-auto">
            <SegmentedControl
              label="Filtrar errores por causa"
              value={selected ?? ALL}
              onChange={setCause}
              options={[
                { value: ALL, label: 'Todas', count: errors.length },
                ...listedCauses.map(({ cause: value, count }) => ({
                  value,
                  label: CAUSE_LABELS[value],
                  count,
                })),
              ]}
            />
          </div>
        )}
        {errors.length < errorsTotal && (
          <p className="font-mono text-xs text-fg-subtle">
            Mostrando las {errors.length} más recientes de {errorsTotal}.
          </p>
        )}
        <ErrorList errors={visible} onRetry={setRetrying} />
      </div>
      {retrying && <RetryTaskDialog error={retrying} onClose={() => setRetrying(null)} />}
    </Card>
  );
}
