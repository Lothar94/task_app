import { Button, ErrorMessage } from '../../components/ui';
import { useExportAgents } from './agentQueries';

export function ExportButtons({ agentId, hasCollaborators }: { agentId: string; hasCollaborators: boolean }) {
  const exportAgents = useExportAgents();
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => exportAgents.mutate({ agentIds: [agentId] })}
        disabled={exportAgents.isPending}
      >
        {exportAgents.isPending ? 'Exportando…' : 'Exportar'}
      </Button>
      {hasCollaborators && (
        <Button
          variant="secondary"
          onClick={() => exportAgents.mutate({ agentIds: [agentId], includeCollaborators: true })}
          disabled={exportAgents.isPending}
        >
          Exportar con colaboradores
        </Button>
      )}
      <div className="basis-full">
        <ErrorMessage error={exportAgents.error} />
      </div>
    </>
  );
}
