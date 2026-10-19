import { MAX_AGENT_SKILLS } from '@fleet/shared';
import { type KeyboardEvent, useId, useState } from 'react';
import { Button, CheckboxList, TextInput } from '../../components/ui';
import {
  addSkill,
  canAddSkill,
  groupSkills,
  missingSkillNote,
  removeSkill,
  SKILL_LIMIT_MESSAGE,
  type SkillGroup,
} from './agentFormModel';
import { useSkills } from './agentQueries';

interface SkillsFieldProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

function SkillChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-1 rounded bg-surface-raised border border-line px-2 py-0.5 text-xs">
      <code>{name}</code>
      <button
        type="button"
        aria-label={`Quitar skill ${name}`}
        onClick={onRemove}
        className="rounded px-1 text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        ×
      </button>
    </li>
  );
}

function SkillGroupList({
  group,
  skills,
  limitReached,
  onChange,
}: SkillsFieldProps & { group: SkillGroup; limitReached: boolean }) {
  const groupNames = new Set(group.skills.map((skill) => skill.name));
  return (
    <fieldset className="mt-2">
      <legend className="mb-1 text-xs font-medium text-fg-muted">{group.label}</legend>
      <CheckboxList
        options={group.skills.map(({ name, description }) => ({ id: name, name, description }))}
        selected={skills.filter((name) => groupNames.has(name))}
        onChange={(selected) => onChange([...skills.filter((name) => !groupNames.has(name)), ...selected])}
        describe={(skill) => skill.description}
        isDisabled={(skill) => limitReached && !skills.includes(skill.id)}
      />
    </fieldset>
  );
}

function SkillCatalog({ skills, onChange }: SkillsFieldProps) {
  const { data, isLoading, isError } = useSkills();
  if (isLoading) return <p className="text-sm text-fg-subtle">Cargando skills instaladas…</p>;
  if (isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        No se pudo cargar el catálogo de skills. Aún puedes añadirlas por nombre.
      </p>
    );
  }
  const catalog = data ?? [];
  if (catalog.length === 0) {
    return (
      <p className="text-sm text-fg-subtle">
        No hay skills instaladas. Instálalas en ~/.claude/skills o en el .claude/skills del proyecto.
      </p>
    );
  }
  const catalogNames = new Set(catalog.map((skill) => skill.name));
  const outsideCatalog = skills.filter((name) => !catalogNames.has(name));
  const limitReached = !canAddSkill(skills);
  return (
    <>
      {groupSkills(catalog).map((group) => (
        <SkillGroupList
          key={group.key}
          group={group}
          skills={skills}
          limitReached={limitReached}
          onChange={onChange}
        />
      ))}
      {limitReached && <p className="mt-2 text-xs text-warning">{SKILL_LIMIT_MESSAGE}</p>}
      {outsideCatalog.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-fg-subtle">
          {outsideCatalog.map((name) => (
            <li key={name}>
              <code>{name}</code>: {missingSkillNote(name)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CustomSkillInput({ skills, onChange }: SkillsFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const result = addSkill(skills, draft);
    setError(result.error);
    if (result.error) return;
    onChange(result.skills);
    setDraft('');
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    add();
  };

  return (
    <div className="mt-3">
      <label htmlFor={id} className="text-xs text-fg-muted">
        Añadir por nombre (skill del proyecto, de Claude Code o de un plugin)
      </label>
      <div className="mt-1 flex gap-2">
        <TextInput
          id={id}
          value={draft}
          placeholder="code-review o plugin:skill"
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="button" variant="secondary" onClick={add}>
          Añadir
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SkillsField({ skills, onChange }: SkillsFieldProps) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Skills</legend>
      <p className="mt-1 mb-2 text-xs text-fg-subtle">
        Se le indicará al agente que use estas skills. Si lo dejas vacío, el agente no tendrá skills (máximo{' '}
        {MAX_AGENT_SKILLS}).
      </p>
      {skills.length > 0 && (
        <ul aria-label="Skills seleccionadas" className="mb-3 flex flex-wrap gap-1">
          {skills.map((name) => (
            <SkillChip key={name} name={name} onRemove={() => onChange(removeSkill(skills, name))} />
          ))}
        </ul>
      )}
      <SkillCatalog skills={skills} onChange={onChange} />
      <CustomSkillInput skills={skills} onChange={onChange} />
    </fieldset>
  );
}
