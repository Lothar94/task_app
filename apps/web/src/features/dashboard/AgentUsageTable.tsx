import type { AgentUsageRow } from '@fleet/shared';
import { Link } from 'react-router';
import { EmptyState } from '../../components/ui';
import { formatCost, formatPercent, formatTokens } from '../../lib/format';

const successRate = (row: AgentUsageRow) =>
  row.completed + row.failed > 0 ? row.completed / (row.completed + row.failed) : null;

export function AgentUsageTable({ rows }: { rows: AgentUsageRow[] }) {
  if (rows.length === 0) return <EmptyState>Sin actividad de agentes en este periodo.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs tracking-wide text-zinc-500 uppercase">
          <tr className="border-b border-zinc-800">
            <th className="py-2 pr-3 font-semibold">Agente</th>
            <th className="px-3 py-2 text-right font-semibold">Completadas</th>
            <th className="px-3 py-2 text-right font-semibold">Fallidas</th>
            <th className="px-3 py-2 text-right font-semibold">Éxito</th>
            <th className="px-3 py-2 text-right font-semibold">Tokens</th>
            <th className="py-2 pl-3 text-right font-semibold">Coste est.</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((row) => (
            <tr key={row.agentId} className="border-b border-zinc-800/60">
              <td className="py-2 pr-3 font-sans">
                <Link to={`/agents/${row.agentId}`} className="hover:text-indigo-300">
                  {row.agentName}
                </Link>
              </td>
              <td className="px-3 py-2 text-right">{row.completed}</td>
              <td className="px-3 py-2 text-right">{row.failed}</td>
              <td className="px-3 py-2 text-right">{formatPercent(successRate(row))}</td>
              <td className="px-3 py-2 text-right">{formatTokens(row.totalTokens)}</td>
              <td className="py-2 pl-3 text-right">{formatCost(row.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
