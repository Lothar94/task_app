import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, Card, EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/ui';
import { useAgents } from '../agents/agentQueries';
import { useCreateProject, useProjects } from './projectQueries';
import { ProjectForm } from './ProjectForm';

export function ProjectsPage() {
  const projects = useProjects();
  const agents = useAgents();
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  if (projects.isPending || agents.isPending) return <Loading />;
  if (projects.error || agents.error) return <ErrorMessage error={projects.error ?? agents.error} />;

  return (
    <>
      <PageHeader
        title="Proyectos"
        subtitle="Cada proyecto tiene una carpeta de trabajo y un equipo de agentes."
        actions={!isCreating && <Button onClick={() => setIsCreating(true)}>Nuevo proyecto</Button>}
      />
      {isCreating && (
        <div className="mb-6">
          <Card
            title="Nuevo proyecto"
            actions={
              <Button variant="secondary" onClick={() => setIsCreating(false)}>
                Cancelar
              </Button>
            }
          >
            <ProjectForm
              agents={agents.data}
              isSubmitting={createProject.isPending}
              error={createProject.error}
              onSubmit={(input) =>
                createProject.mutate(input, { onSuccess: (project) => navigate(`/projects/${project.id}`) })
              }
            />
          </Card>
        </div>
      )}
      {projects.data.length === 0 ? (
        <EmptyState>No hay proyectos todavía.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.data.map((project) => (
            <li key={project.id}>
              <Link
                to={`/projects/${project.id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-indigo-500/60"
              >
                <h2 className="font-semibold">{project.name}</h2>
                {project.description && <p className="mt-1 text-sm text-zinc-400">{project.description}</p>}
                <p className="mt-2 font-mono text-xs text-zinc-500">{project.workspacePath}</p>
                <p className="mt-1 text-xs text-zinc-500">{project.memberIds.length} agente(s)</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
