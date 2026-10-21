import { AGENT_MODELS, type AgentDto, EFFORT_LEVELS } from '@fleet/shared';
import { Field, Select } from '../../components/ui';
import { EFFORT_LABELS } from '../agents/agentLabels';
import { defaultEffortOption, defaultModelOption, type ModelChoiceValues } from './taskFormModel';

/** Optional model/effort selects for auto agents; the first option keeps the agent's own values. */
export function ModelChoiceFields({
  agent,
  value,
  onChange,
}: {
  agent: AgentDto;
  value: ModelChoiceValues;
  onChange: (value: ModelChoiceValues) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Modelo" hint="Según la dificultad de la tarea">
        <Select
          value={value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value as ModelChoiceValues['model'] })}
        >
          <option value="">{defaultModelOption(agent)}</option>
          {AGENT_MODELS.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Esfuerzo">
        <Select
          value={value.effort}
          onChange={(e) => onChange({ ...value, effort: e.target.value as ModelChoiceValues['effort'] })}
        >
          <option value="">{defaultEffortOption(agent)}</option>
          {EFFORT_LEVELS.map((effort) => (
            <option key={effort} value={effort}>
              {EFFORT_LABELS[effort]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
