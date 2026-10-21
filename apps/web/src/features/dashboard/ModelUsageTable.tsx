import type { ModelUsageRow } from '@fleet/shared';
import { formatCost, formatInteger, formatPercent, formatPrice } from '../../lib/format';
import { cacheSavingsRate } from './dashboardModel';

const COLUMNS = [
  'Modelo',
  'Entrada',
  'Salida',
  'Escritura caché',
  'Lectura caché',
  'Total',
  'Precio US$/MTok (ent. / sal. / esc. / lec.)',
  'Coste entrada',
  'Coste salida',
  'Coste escritura',
  'Coste lectura',
  'Coste est.',
  'Ahorro caché',
];

function Price({ pricing }: Pick<ModelUsageRow, 'pricing'>) {
  if (!pricing) return <span className="text-fg-subtle">sin tarifa</span>;
  const { inputPerMTok, outputPerMTok, cacheWritePerMTok, cacheReadPerMTok } = pricing;
  return (
    <>{[inputPerMTok, outputPerMTok, cacheWritePerMTok, cacheReadPerMTok].map(formatPrice).join(' / ')}</>
  );
}

/** Exact numbers behind the model chart (its table view); per-kind costs need a price, so they read "—" without one. */
export function ModelUsageTable({ rows }: { rows: ModelUsageRow[] }) {
  const kindCost = (row: ModelUsageRow, usd: number) => (row.pricing ? formatCost(usd) : '—');
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs tabular-nums">
        <thead className="label-mono text-left text-fg-subtle">
          <tr className="border-b border-line">
            {COLUMNS.map((column, index) => (
              <th key={column} scope="col" className={`py-2 ${index === 0 ? 'pr-3' : 'px-3 text-right'}`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const savings = cacheSavingsRate(row);
            return (
              <tr key={row.model} className="border-b border-line transition-colors hover:bg-surface-hover">
                <td className="py-2 pr-3">{row.model}</td>
                <td className="px-3 py-2 text-right">{formatInteger(row.inputTokens)}</td>
                <td className="px-3 py-2 text-right">{formatInteger(row.outputTokens)}</td>
                <td className="px-3 py-2 text-right">{formatInteger(row.cacheCreationTokens)}</td>
                <td className="px-3 py-2 text-right">{formatInteger(row.cacheReadTokens)}</td>
                <td className="px-3 py-2 text-right text-fg">{formatInteger(row.totalTokens)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Price pricing={row.pricing} />
                </td>
                <td className="px-3 py-2 text-right">{kindCost(row, row.cost.inputUsd)}</td>
                <td className="px-3 py-2 text-right">{kindCost(row, row.cost.outputUsd)}</td>
                <td className="px-3 py-2 text-right">{kindCost(row, row.cost.cacheWriteUsd)}</td>
                <td className="px-3 py-2 text-right">{kindCost(row, row.cost.cacheReadUsd)}</td>
                <td className="px-3 py-2 text-right text-fg">{formatCost(row.costUsd)}</td>
                <td className="py-2 pl-3 text-right">
                  {formatCost(row.cacheSavingsUsd)}
                  {savings !== null && row.cacheSavingsUsd > 0 && (
                    <span className="text-fg-subtle"> ({formatPercent(savings)})</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
