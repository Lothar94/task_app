import { AGENT_MODELS, type AgentDto, EFFORT_LEVELS, PERMISSION_MODES } from '@fleet/shared';
import { type FormEvent, useState } from 'react';
import { Button, Card, CheckboxList, ErrorMessage, Field, Select, TextInput } from '../../components/ui';
import type { AgentFormValues } from './agentFormModel';
import { EFFORT_LABELS, MODEL_LABELS, PERMISSION_LABELS } from './agentLabels';
import { InstructionsField } from './InstructionsField';
import { SkillsField } from './SkillsField';

const submittingLabel = (isNew: boolean, values: AgentFormValues) =>
  isNew && !values.instructions.trim() ? 'Creando y redactando instrucciones…' : 'Guardando…';

interface AgentFormProps {
  initialValues: AgentFormValues;
  isNew: boolean;
  teammates: AgentDto[];
  submitLabel: string;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: (values: AgentFormValues) => void;
}

export function AgentForm(props: AgentFormProps) {
  const { initialValues, isNew, teammates, submitLabel, isSubmitting, error, onSubmit } = props;
  const [values, setValues] = useState(initialValues);
  const set = <K extends keyof AgentFormValues>(key: K, value: AgentFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card title="Identidad">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" hint="Único; los demás agentes lo usan para delegarle trabajo">
            <TextInput required value={values.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Rol">
            <TextInput required value={values.role} onChange={(e) => set('role', e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Descripción" hint="Lo que verán sus compañeros al decidir a quién delegar">
            <TextInput value={values.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="Instrucciones">
        <InstructionsField
          values={values}
          isNew={isNew}
          onInstructionsChange={(text) => set('instructions', text)}
          onGuidanceChange={(text) => set('instructionsGuidance', text)}
        />
      </Card>

      <Card title="Configuración">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Modelo">
            <Select
              value={values.model}
              onChange={(e) => set('model', e.target.value as AgentFormValues['model'])}
            >
              {AGENT_MODELS.map((model) => (
                <option key={model} value={model}>
                  {MODEL_LABELS[model]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Intensidad" hint="Cuánto razona el modelo antes de actuar">
            <Select
              value={values.effort}
              onChange={(e) => set('effort', e.target.value as AgentFormValues['effort'])}
            >
              {EFFORT_LEVELS.map((effort) => (
                <option key={effort} value={effort}>
                  {EFFORT_LABELS[effort]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Permisos">
            <Select
              value={values.permissionMode}
              onChange={(e) => set('permissionMode', e.target.value as AgentFormValues['permissionMode'])}
            >
              {PERMISSION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {PERMISSION_LABELS[mode]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Máx. turnos">
            <TextInput
              type="number"
              min={1}
              max={500}
              value={values.maxTurns}
              onChange={(e) => set('maxTurns', Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field
            label="Herramientas permitidas"
            hint="Separadas por comas, p. ej. Read, Write, Edit, Bash, WebSearch"
          >
            <TextInput value={values.allowedTools} onChange={(e) => set('allowedTools', e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <SkillsField skills={values.skills} onChange={(skills) => set('skills', skills)} />
        </div>
      </Card>

      <Card title="Puede delegar en">
        <CheckboxList
          options={teammates}
          selected={values.collaboratorIds}
          onChange={(ids) => set('collaboratorIds', ids)}
          describe={(agent) => agent.role}
        />
      </Card>

      <ErrorMessage error={error} />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? submittingLabel(isNew, values) : submitLabel}
      </Button>
    </form>
  );
}
