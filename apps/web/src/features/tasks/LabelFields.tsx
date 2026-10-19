import { useId } from 'react';
import { Field, TextInput } from '../../components/ui';
import { addTag, parseTags } from './taskFormModel';
import { TaskLabels } from './TaskLabels';

interface LabelFieldsProps {
  milestone: string;
  tagsText: string;
  onMilestoneChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  milestoneSuggestions: string[];
  tagSuggestions: string[];
}

/** Milestone (with suggestions) and comma-separated tags (with suggestions and chip preview). */
export function LabelFields({
  milestone,
  tagsText,
  onMilestoneChange,
  onTagsChange,
  milestoneSuggestions,
  tagSuggestions,
}: LabelFieldsProps) {
  const listId = useId();
  const tags = parseTags(tagsText);
  const unused = tagSuggestions.filter(
    (tag) => !tags.some((value) => value.toLowerCase() === tag.toLowerCase()),
  );
  return (
    <>
      <Field label="Milestone" hint="Opcional. Agrupa tareas de un mismo hito">
        <TextInput
          list={listId}
          value={milestone}
          onChange={(e) => onMilestoneChange(e.target.value)}
          autoComplete="off"
        />
        <datalist id={listId}>
          {milestoneSuggestions.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </Field>
      <Field label="Tags" hint="Opcional. Separados por comas">
        <TextInput value={tagsText} onChange={(e) => onTagsChange(e.target.value)} autoComplete="off" />
      </Field>
      {tags.length > 0 && (
        <div aria-live="polite" className="flex items-center gap-2 text-xs text-fg-subtle">
          Vista previa: <TaskLabels milestone={null} tags={tags} />
        </div>
      )}
      {unused.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-fg-subtle">
          <span>Tags existentes:</span>
          {unused.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-label={`Añadir tag ${tag}`}
              onClick={() => onTagsChange(addTag(tagsText, tag))}
              className="rounded-sm border border-line-strong px-1.5 py-0.5 text-fg-muted hover:border-accent"
            >
              +{tag}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
