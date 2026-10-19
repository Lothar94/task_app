import { type AgentDto, type ProjectDto, isArchivedProject } from '@fleet/shared';
import { useState } from 'react';
import { Button, Card, CheckboxList, ErrorMessage } from '../../components/ui';
import { useSetProjectMembers } from './projectQueries';

export function ProjectMembers({ project, agents }: { project: ProjectDto; agents: AgentDto[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState(project.memberIds);
  const setMembers = useSetProjectMembers(project.id);
  const isArchived = isArchivedProject(project);
  const members = agents.filter((agent) => project.memberIds.includes(agent.id));

  const save = () => setMembers.mutate(selected, { onSuccess: () => setIsEditing(false) });
  const startEditing = () => {
    setSelected(project.memberIds);
    setIsEditing(true);
  };

  return (
    <Card
      title="Equipo"
      actions={
        isEditing ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={setMembers.isPending}>
              Guardar
            </Button>
          </div>
        ) : (
          !isArchived && (
            <Button variant="secondary" onClick={startEditing}>
              Editar
            </Button>
          )
        )
      }
    >
      {isEditing ? (
        <CheckboxList
          options={agents}
          selected={selected}
          onChange={setSelected}
          describe={(agent) => agent.role}
        />
      ) : (
        <ul className="space-y-1 text-sm">
          {members.length === 0 && <li className="text-fg-subtle">Sin agentes asignados.</li>}
          {members.map((agent) => (
            <li key={agent.id}>
              <span className="font-medium">{agent.name}</span>{' '}
              <span className="text-fg-subtle">· {agent.role}</span>
            </li>
          ))}
        </ul>
      )}
      <ErrorMessage error={setMembers.error} />
    </Card>
  );
}
