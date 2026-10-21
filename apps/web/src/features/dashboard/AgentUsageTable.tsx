import type { AgentUsageRow } from '@fleet/shared';
import { Link } from 'react-router';
import { EmptyState, FOCUS_RING } from '../../components/ui';
import { formatCost, formatPercent, formatTokens } from '../../lib/format';
import { successRateOf, sumCost } from './dashboardModel';

export function AgentUsageTable({ rows }: { rows: AgentUsageRow[] }) {
  if (rows.length === 0) return <EmptyState>Sin actividad de agentes en este periodo.</EmptyState>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="label-mono text-left text-fg-subtle">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-3 font-normal">
                Agente
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Completadas
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Fallidas
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Éxito
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Tokens
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">
                Coste est.
              </th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map((row) => (
              <tr key={row.agentId} className="border-b border-line transition-colors hover:bg-surface-hover">
                <td className="py-2 pr-3 font-sans">
                  <Link
                    to={`/agents/${row.agentId}`}
                    className={`font-medium text-fg hover:text-accent ${FOCUS_RING}`}
                  >
                    {row.agentName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right">{row.completed}</td>
                <td className={`px-3 py-2 text-right ${row.failed > 0 ? 'text-danger' : 'text-fg-subtle'}`}>
                  {row.failed}
                </td>
                <td className="px-3 py-2 text-right text-success">{formatPercent(successRateOf(row))}</td>
                <td className="px-3 py-2 text-right">{formatTokens(row.totalTokens)}</td>
                <td className="py-2 pl-3 text-right">{formatCost(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-right font-mono text-xs text-fg-muted tabular-nums">
        Total facturado flota: <span className="text-fg">{formatCost(sumCost(rows))}</span>
      </p>
    </>
  );
}
