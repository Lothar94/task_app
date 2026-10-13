import type { AgentDto, TaskDto } from '@fleet/shared';
import { type FormEvent, useState } from 'react';
import { Button, ErrorMessage, Field, Select, TextArea, TextInput } from '../../components/ui';
import { useAssignTask } from './taskQueries';

interface AssignTaskFormProps {
  projectId: string;
  members: AgentDto[];
  onAssigned: (task: TaskDto) => void;
}

export function AssignTaskForm({ projectId, members, onAssigned }: AssignTaskFormProps) {
  const [agentId, setAgentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const assignTask = useAssignTask(projectId);

  if (members.length === 0)
    return <p className="text-sm text-zinc-500">Añade agentes al proyecto primero.</p>;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    assignTask.mutate(
      { agentId: agentId || (members[0]?.id ?? ''), title, description },
      { onSuccess: onAssigned },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Responsable">
        <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {members.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} — {agent.role}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Título">
        <TextInput required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Descripción" hint="Contexto, objetivo y criterios de aceptación">
        <TextArea required rows={10} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <ErrorMessage error={assignTask.error} />
      <div className="flex justify-end">
        <Button type="submit" disabled={assignTask.isPending}>
          {assignTask.isPending ? 'Asignando…' : 'Asignar tarea'}
        </Button>
      </div>
    </form>
  );
}
