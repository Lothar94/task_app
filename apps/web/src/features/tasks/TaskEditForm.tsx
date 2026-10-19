import type { AgentDto, TaskDto } from '@fleet/shared';
import { type FormEvent, useState } from 'react';
import { Button, ErrorMessage, Field, Select, TextArea, TextInput } from '../../components/ui';
import { LabelFields } from './LabelFields';
import { formatTags, milestoneOrNull, parseTags, validateLabels } from './taskFormModel';
import { useUpdateTask } from './taskQueries';

interface TaskEditFormProps {
  task: TaskDto;
  /** Agents that can be made responsible; ignored when only milestone/tags are editable. */
  members: AgentDto[];
  milestones: string[];
  tags: string[];
  /** Title, description and agent can only change while the task has not started. */
  canEditContent: boolean;
  onSaved: () => void;
}

export function TaskEditForm({
  task,
  members,
  milestones,
  tags,
  canEditContent,
  onSaved,
}: TaskEditFormProps) {
  const [agentId, setAgentId] = useState(task.agentId);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [milestone, setMilestone] = useState(task.milestone ?? '');
  const [tagsText, setTagsText] = useState(formatTags(task.tags));
  const updateTask = useUpdateTask(task);
  const labelsError = validateLabels(milestone, tagsText);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (labelsError) return;
    updateTask.mutate(
      {
        ...(canEditContent && { agentId, title, description }),
        milestone: milestoneOrNull(milestone),
        tags: parseTags(tagsText),
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {canEditContent && (
        <>
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
            <TextInput required value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Descripción">
            <TextArea
              required
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </>
      )}
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
      <ErrorMessage error={updateTask.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onSaved}>
          Cancelar
        </Button>
        <Button type="submit" disabled={updateTask.isPending}>
          {updateTask.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
