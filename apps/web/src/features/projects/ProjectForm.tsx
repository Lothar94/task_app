import type { AgentDto, ProjectInput } from '@fleet/shared';
import { type FormEvent, useState } from 'react';
import { Button, CheckboxList, ErrorMessage, Field, TextInput } from '../../components/ui';

const EMPTY_PROJECT: ProjectInput = { name: '', description: '', workspacePath: '', memberIds: [] };

interface ProjectFormProps {
  agents: AgentDto[];
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (input: ProjectInput) => void;
}

export function ProjectForm({ agents, isSubmitting, error, onSubmit }: ProjectFormProps) {
  const [values, setValues] = useState(EMPTY_PROJECT);
  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <TextInput required value={values.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Carpeta de trabajo" hint="Ruta absoluta; se crea si no existe">
          <TextInput
            required
            placeholder="/home/usuario/proyectos/mi-app"
            value={values.workspacePath}
            onChange={(e) => set('workspacePath', e.target.value)}
          />
        </Field>
      </div>
      <Field label="Descripción">
        <TextInput value={values.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Field label="Agentes del proyecto">
        <CheckboxList
          options={agents}
          selected={values.memberIds}
          onChange={(ids) => set('memberIds', ids)}
          describe={(agent) => agent.role}
        />
      </Field>
      <ErrorMessage error={error} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear proyecto'}
      </Button>
    </form>
  );
}
