import type { ModelUsageRow } from '@fleet/shared';
import { formatCost, formatInteger } from '../../lib/format';

/** Exact numbers behind the model chart (its table view). */
export function ModelUsageTable({ rows }: { rows: ModelUsageRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs tabular-nums">
        <thead className="text-left font-sans tracking-wide text-zinc-500 uppercase">
          <tr className="border-b border-zinc-800">
            <th className="py-2 pr-3">Modelo</th>
            <th className="px-3 py-2 text-right">Entrada</th>
            <th className="px-3 py-2 text-right">Salida</th>
            <th className="px-3 py-2 text-right">Escritura caché</th>
            <th className="px-3 py-2 text-right">Lectura caché</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="py-2 pl-3 text-right">Coste est.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model} className="border-b border-zinc-800/60">
              <td className="py-2 pr-3">{row.model}</td>
              <td className="px-3 py-2 text-right">{formatInteger(row.inputTokens)}</td>
              <td className="px-3 py-2 text-right">{formatInteger(row.outputTokens)}</td>
              <td className="px-3 py-2 text-right">{formatInteger(row.cacheCreationTokens)}</td>
              <td className="px-3 py-2 text-right">{formatInteger(row.cacheReadTokens)}</td>
              <td className="px-3 py-2 text-right text-zinc-100">{formatInteger(row.totalTokens)}</td>
              <td className="py-2 pl-3 text-right">{formatCost(row.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
