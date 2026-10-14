import type { AgentDto } from '@fleet/shared';
import { useNavigate, useParams } from 'react-router';
import { ErrorMessage, Loading, PageHeader } from '../../components/ui';
import { useSyncOrganization } from '../organizations/OrganizationContext';
import { AgentForm } from './AgentForm';
import { EMPTY_AGENT_FORM, toAgentInput, toFormValues, type AgentFormValues } from './agentFormModel';
import { useAgent, useAgents, useSaveAgent } from './agentQueries';

function AgentEditor({ agentId, agents }: { agentId: string | undefined; agents: AgentDto[] }) {
  const navigate = useNavigate();
  const saveAgent = useSaveAgent();
  const agent = agents.find((candidate) => candidate.id === agentId);
  if (agentId && !agent) return <ErrorMessage error="Agente no encontrado" />;

  const handleSubmit = (values: AgentFormValues) =>
    saveAgent.mutate(
      {
        id: agentId,
        input: toAgentInput(values),
        collaboratorIds: values.collaboratorIds,
        instructionsGuidance: values.instructionsGuidance,
      },
      { onSuccess: (saved) => navigate(`/agents/${saved.id}`) },
    );

  return (
    <>
      <PageHeader title={agent ? `Editar ${agent.name}` : 'Nuevo agente'} />
      <AgentForm
        initialValues={agent ? toFormValues(agent) : EMPTY_AGENT_FORM}
        isNew={!agent}
        teammates={agents.filter((candidate) => candidate.id !== agentId)}
        submitLabel={agent ? 'Guardar cambios' : 'Crear agente'}
        isSubmitting={saveAgent.isPending}
        error={saveAgent.error}
        onSubmit={handleSubmit}
      />
    </>
  );
}

export function AgentEditorPage() {
  const { agentId } = useParams();
  const requested = useAgent(agentId ?? '');
  const isInOrganization = useSyncOrganization(requested.data?.organizationId);
  const agents = useAgents();

  const error = requested.error ?? agents.error;
  if (error) return <ErrorMessage error={error} />;
  if (requested.isLoading || !isInOrganization || !agents.data) return <Loading />;
  return <AgentEditor agentId={agentId} agents={agents.data} />;
}
