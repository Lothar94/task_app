import { useNavigate, useParams } from 'react-router';
import { ErrorMessage, Loading, PageHeader } from '../../components/ui';
import { AgentForm } from './AgentForm';
import { EMPTY_AGENT_FORM, toAgentInput, toFormValues, type AgentFormValues } from './agentFormModel';
import { useAgents, useSaveAgent } from './agentQueries';

export function AgentEditorPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const agents = useAgents();
  const saveAgent = useSaveAgent();

  if (agents.isPending) return <Loading />;
  if (agents.error) return <ErrorMessage error={agents.error} />;

  const agent = agents.data.find((candidate) => candidate.id === agentId);
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
        teammates={agents.data.filter((candidate) => candidate.id !== agentId)}
        submitLabel={agent ? 'Guardar cambios' : 'Crear agente'}
        isSubmitting={saveAgent.isPending}
        error={saveAgent.error}
        onSubmit={handleSubmit}
      />
    </>
  );
}
