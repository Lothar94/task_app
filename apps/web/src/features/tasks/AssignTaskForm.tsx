import type { AgentDto, TaskDto } from '@fleet/shared';
import { type FormEvent, useState } from 'react';
import { Button, ErrorMessage, Field, Select, TextArea, TextInput } from '../../components/ui';
import { LabelFields } from './LabelFields';
import { milestoneOrNull, parseTags, startModeOf, validateLabels } from './taskFormModel';
import { useAssignTask } from './taskQueries';

interface AssignTaskFormProps {
  projectId: string;
  members: AgentDto[];
  /** Milestones and tags already used in the project, offered as suggestions. */
  milestones: string[];
  tags: string[];
  onAssigned: (task: TaskDto) => void;
}

export function AssignTaskForm({ projectId, members, milestones, tags, onAssigned }: AssignTaskFormProps) {
  const [agentId, setAgentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [milestone, setMilestone] = useState('');
  const [tagsText, setTagsText] = useState('');
  const assignTask = useAssignTask(projectId);

  if (members.length === 0)
    return <p className="text-sm text-fg-subtle">Añade agentes al proyecto primero.</p>;

  const labelsError = validateLabels(milestone, tagsText);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const start = startModeOf(submitter?.value);
    if (labelsError) return;
    assignTask.mutate(
      {
        agentId: agentId || (members[0]?.id ?? ''),
        title,
        description,
        start,
        milestone: milestoneOrNull(milestone),
        tags: parseTags(tagsText),
      },
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
      <LabelFields
        milestone={milestone}
        tagsText={tagsText}
        onMilestoneChange={setMilestone}
        onTagsChange={setTagsText}
        milestoneSuggestions={milestones}
        tagSuggestions={tags}
      />
      {labelsError && (
        <p role="alert" className="text-sm text-danger">
          {labelsError}
        </p>
      )}
      <ErrorMessage error={assignTask.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" value="draft" variant="secondary" disabled={assignTask.isPending}>
          Guardar borrador
        </Button>
        <Button type="submit" value="queue" variant="secondary" disabled={assignTask.isPending}>
          Añadir a la cola
        </Button>
        <Button type="submit" value="now" disabled={assignTask.isPending}>
          {assignTask.isPending ? 'Enviando…' : 'Crear e iniciar'}
        </Button>
      </div>
    </form>
  );
}
