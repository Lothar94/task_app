import { MAX_AGENT_SKILLS } from '@fleet/shared';
import { type KeyboardEvent, useId, useState } from 'react';
import { Button, CheckboxList, TextInput } from '../../components/ui';
import { addSkill, removeSkill } from './agentFormModel';
import { useSkills } from './agentQueries';

interface SkillsFieldProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

function SkillChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs">
      <code>{name}</code>
      <button
        type="button"
        aria-label={`Quitar skill ${name}`}
        onClick={onRemove}
        className="rounded px-1 text-zinc-400 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-400"
      >
        ×
      </button>
    </li>
  );
}

function SkillCatalog({ skills, onChange }: SkillsFieldProps) {
  const { data, isLoading, isError } = useSkills();
  if (isLoading) return <p className="text-sm text-zinc-500">Cargando skills instaladas…</p>;
  if (isError) {
    return (
      <p role="alert" className="text-sm text-red-300">
        No se pudo cargar el catálogo de skills. Aún puedes añadirlas por nombre.
      </p>
    );
  }
  const catalog = data ?? [];
  if (catalog.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hay skills instaladas. Instálalas en ~/.claude/skills o en el .claude/skills del proyecto.
      </p>
    );
  }
  const catalogNames = new Set(catalog.map((skill) => skill.name));
  const outsideCatalog = skills.filter((name) => !catalogNames.has(name));
  return (
    <>
      <CheckboxList
        options={catalog.map(({ name, description }) => ({ id: name, name, description }))}
        selected={skills.filter((name) => catalogNames.has(name))}
        onChange={(selected) => onChange([...outsideCatalog, ...selected])}
        describe={(skill) => skill.description}
      />
      {outsideCatalog.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-zinc-500">
          {outsideCatalog.map((name) => (
            <li key={name}>
              <code>{name}</code>: no instalada en ~/.claude/skills: debe existir en el proyecto
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
      <label htmlFor={id} className="text-xs text-zinc-400">
        Añadir por nombre (skills de Claude Code o del proyecto)
      </label>
      <div className="mt-1 flex gap-2">
        <TextInput
          id={id}
          value={draft}
          placeholder="code-review"
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
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function SkillsField({ skills, onChange }: SkillsFieldProps) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Skills</legend>
      <p className="mt-1 mb-2 text-xs text-zinc-500">
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
