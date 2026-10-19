import type { ModelUsageRow } from '@fleet/shared';
import { formatCost, formatInteger } from '../../lib/format';

/** Exact numbers behind the model chart (its table view). */
export function ModelUsageTable({ rows }: { rows: ModelUsageRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs tabular-nums">
        <thead className="label-mono text-left text-fg-subtle">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-3">
              Modelo
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Entrada
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Salida
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Escritura caché
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Lectura caché
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Total
            </th>
            <th scope="col" className="py-2 pl-3 text-right">
              Coste est.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model} className="border-b border-line transition-colors hover:bg-surface-hover">
              <td className="py-2 pr-3">{row.model}</td>
              <td className="px-3 py-2 text-right">{formatInteger(row.inputTokens)}</td>
              <td className="px-3 py-2 text-right">{formatInteger(row.outputTokens)}</td>
              <td className="px-3 py-2 text-right">{formatInteger(row.cacheCreationTokens)}</td>
              <td className="px-3 py-2 text-right">{formatInteger(row.cacheReadTokens)}</td>
              <td className="px-3 py-2 text-right text-fg">{formatInteger(row.totalTokens)}</td>
              <td className="py-2 pl-3 text-right">{formatCost(row.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
