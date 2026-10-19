import type { AgentDto } from '@fleet/shared';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Markdown } from '../../components/Markdown';
import { Button, ErrorMessage, LinkButton, Loading, PageHeader } from '../../components/ui';
import { EFFORT_LABELS, MODEL_LABELS, PERMISSION_LABELS } from './agentLabels';
import { useSyncOrganization } from '../organizations/OrganizationContext';
import { AgentAvatar } from './AgentAvatar';
import { AgentSection } from './AgentSection';
import { ExportButtons } from './ExportButtons';
import { useAgent, useAgents, useDeleteAgent } from './agentQueries';

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="label-mono text-fg-subtle">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function AgentLinks({ agents }: { agents: AgentDto[] }) {
  if (agents.length === 0) return <p className="text-sm text-fg-subtle">Ninguno</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {agents.map((agent) => (
        <li key={agent.id}>
          <Link
            to={`/agents/${agent.id}`}
            className="flex items-center gap-2 rounded-sm border border-line bg-surface-raised px-2 py-1 text-sm hover:border-line-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <AgentAvatar name={agent.name} />
            <span>
              {agent.name} <span className="text-fg-subtle">· {agent.role}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) return <span className="text-fg-subtle">Sin skills</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {skills.map((skill) => (
        <code key={skill} className="rounded-sm border border-line bg-surface-raised px-2 py-0.5 text-xs">
          {skill}
        </code>
      ))}
    </div>
  );
}

export function AgentDetailPage() {
  const { agentId = '' } = useParams();
  const navigate = useNavigate();
  const requested = useAgent(agentId);
  const isInOrganization = useSyncOrganization(requested.data?.organizationId);
  const agents = useAgents();
  const deleteAgent = useDeleteAgent();

  if (requested.error) return <ErrorMessage error={requested.error} />;
  if (requested.isPending || !isInOrganization || agents.isPending) return <Loading />;
  if (agents.error) return <ErrorMessage error={agents.error} />;
  const agent = agents.data.find((candidate) => candidate.id === agentId);
  if (!agent) return <ErrorMessage error="Agente no encontrado" />;

  const collaborators = agents.data.filter((candidate) => agent.collaboratorIds.includes(candidate.id));
  const delegators = agents.data.filter((candidate) => candidate.collaboratorIds.includes(agent.id));
  const handleDelete = () => {
    if (!confirm(`¿Eliminar el agente ${agent.name}?`)) return;
    deleteAgent.mutate(agent.id, { onSuccess: () => navigate('/agents') });
  };

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/agents">← Agentes</Link>}
        title={agent.name}
        subtitle={agent.role}
        actions={
          <>
            <ExportButtons agentId={agent.id} hasCollaborators={collaborators.length > 0} />
            <LinkButton to={`/agents/${agent.id}/edit`}>Editar</LinkButton>
            <Button variant="danger" onClick={handleDelete} disabled={deleteAgent.isPending}>
              Eliminar
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        <ErrorMessage error={deleteAgent.error} />
        {agent.description && <Markdown className="text-fg-muted">{agent.description}</Markdown>}
        <AgentSection title="Configuración">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Property label="Modelo">{MODEL_LABELS[agent.model]}</Property>
            <Property label="Intensidad">{EFFORT_LABELS[agent.effort]}</Property>
            <Property label="Permisos">{PERMISSION_LABELS[agent.permissionMode]}</Property>
            <Property label="Máx. turnos">{agent.maxTurns}</Property>
            <Property label="Actualizado">{new Date(agent.updatedAt).toLocaleString()}</Property>
          </dl>
          <div className="mt-4">
            <Property label="Herramientas">
              <div className="flex flex-wrap gap-1">
                {agent.allowedTools.map((tool) => (
                  <code
                    key={tool}
                    className="rounded-sm border border-line bg-surface-raised px-2 py-0.5 text-xs"
                  >
                    {tool}
                  </code>
                ))}
              </div>
            </Property>
          </div>
          <div className="mt-4">
            <Property label="Skills">
              <SkillChips skills={agent.skills} />
            </Property>
          </div>
        </AgentSection>
        <AgentSection title="Instrucciones">
          <Markdown className="prose-base">{agent.instructions}</Markdown>
        </AgentSection>
        <div className="grid gap-4 md:grid-cols-2">
          <AgentSection title="Puede delegar en">
            <AgentLinks agents={collaborators} />
          </AgentSection>
          <AgentSection title="Recibe trabajo de">
            <AgentLinks agents={delegators} />
          </AgentSection>
        </div>
      </div>
    </>
  );
}
