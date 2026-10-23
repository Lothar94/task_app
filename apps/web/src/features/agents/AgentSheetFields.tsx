import {
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_MODELS,
  AGENT_TEMPERATURE_RANGE,
  type AgentDto,
  type AgentEffort,
  type AgentModel,
  EFFORT_LEVELS,
} from '@fleet/shared';
import { type ReactNode, useId } from 'react';
import { Select, TextArea, TextInput } from '../../components/ui';
import { formatInteger } from '../../lib/format';
import { AUTO_SELECTION_HINT, EFFORT_LABELS, MODEL_LABELS, modelFieldLabels } from './agentLabels';
import {
  CUSTOM_TEMPERATURE_START,
  type McpOption,
  toggleItem,
  toolOptions,
  mcpOptions,
} from './agentSheetForm';
import type { AgentSheetForm } from './useAgentSheetForm';

interface FieldsProps {
  agent: AgentDto;
  form: AgentSheetForm;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line pt-4">
      <h3 className="label-mono text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

/** A labelled control with its hint and error linked through aria-describedby. */
function SheetField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <label className="block space-y-1">
      <span className="label-mono block text-fg-subtle">{label}</span>
      {children(describedBy)}
      {hint && (
        <span id={`${id}-hint`} className="block text-xs text-fg-subtle">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

function InstructionsInput({ form }: FieldsProps) {
  const error = form.fieldErrors.instructions;
  return (
    <SheetField label="Instrucciones (system prompt)" error={error}>
      {(describedBy) => (
        <TextArea
          rows={8}
          value={form.values.instructions}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => form.setField('instructions', event.target.value)}
        />
      )}
    </SheetField>
  );
}

function ModelFields({ agent, form }: FieldsProps) {
  const labels = modelFieldLabels(agent.modelSelection);
  return (
    <Section title="Modelo asignado">
      <SheetField label={labels.model} error={form.fieldErrors.model}>
        {(describedBy) => (
          <Select
            value={form.values.model}
            aria-describedby={describedBy}
            onChange={(event) => form.setField('model', event.target.value as AgentModel)}
          >
            {AGENT_MODELS.map((model) => (
              <option key={model} value={model}>
                {MODEL_LABELS[model]}
              </option>
            ))}
          </Select>
        )}
      </SheetField>
      <SheetField
        label={labels.effort}
        hint={agent.modelSelection === 'auto' ? AUTO_SELECTION_HINT : undefined}
        error={form.fieldErrors.effort}
      >
        {(describedBy) => (
          <Select
            value={form.values.effort}
            aria-describedby={describedBy}
            onChange={(event) => form.setField('effort', event.target.value as AgentEffort)}
          >
            {EFFORT_LEVELS.map((effort) => (
              <option key={effort} value={effort}>
                {EFFORT_LABELS[effort]}
              </option>
            ))}
          </Select>
        )}
      </SheetField>
    </Section>
  );
}

/** Why a runtime setting cannot be edited right now; undefined when it can. */
function runtimeHint(runtime: AgentSheetForm['runtime'], supported: boolean | undefined) {
  if (runtime.isPending) return 'Comprobando qué admite el runtime…';
  if (runtime.isError) return 'No se pudo consultar el runtime; no se puede ajustar.';
  return supported ? undefined : 'El runtime actual no admite este ajuste; se usa su valor por defecto.';
}

function TemperatureField({ form }: FieldsProps) {
  const hint = runtimeHint(form.runtime, form.runtime.data?.supports.temperature);
  const { temperature } = form.values;
  const isDefault = temperature === null;
  const hintId = useId();
  return (
    <fieldset className="space-y-1" aria-describedby={hint ? hintId : undefined}>
      <legend className="label-mono text-fg-subtle">Temperatura</legend>
      <label className="flex items-center gap-2 text-xs text-fg-muted">
        <input
          type="checkbox"
          className="accent-accent"
          checked={isDefault}
          disabled={Boolean(hint)}
          onChange={(event) =>
            form.setField('temperature', event.target.checked ? null : CUSTOM_TEMPERATURE_START)
          }
        />
        Valor por defecto del runtime
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label="Temperatura"
          className="min-w-0 flex-1 accent-accent disabled:opacity-50"
          min={AGENT_TEMPERATURE_RANGE.min}
          max={AGENT_TEMPERATURE_RANGE.max}
          step={0.05}
          value={temperature ?? CUSTOM_TEMPERATURE_START}
          aria-valuetext={isDefault ? 'valor por defecto' : temperature.toFixed(2)}
          disabled={Boolean(hint) || isDefault}
          onChange={(event) => form.setField('temperature', Number(event.target.value))}
        />
        {/* The slider announces its value (aria-valuetext); this is the visible copy. */}
        <span aria-hidden className="w-16 text-right font-mono text-xs text-fg">
          {isDefault ? 'defecto' : temperature.toFixed(2)}
        </span>
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {form.fieldErrors.temperature && <p className="text-xs text-danger">{form.fieldErrors.temperature}</p>}
    </fieldset>
  );
}

function MaxOutputTokensField({ form }: FieldsProps) {
  const unsupported = runtimeHint(form.runtime, form.runtime.data?.supports.maxOutputTokens);
  const error = form.fieldErrors.maxOutputTokens;
  return (
    <SheetField
      label="Máx. tokens de salida"
      hint={
        unsupported ?? `Vacío usa el valor por defecto; máximo ${formatInteger(AGENT_MAX_OUTPUT_TOKENS)}.`
      }
      error={error}
    >
      {(describedBy) => (
        <TextInput
          type="number"
          inputMode="numeric"
          min={1}
          max={AGENT_MAX_OUTPUT_TOKENS}
          placeholder="Por defecto"
          value={form.values.maxOutputTokens}
          disabled={Boolean(unsupported)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => form.setField('maxOutputTokens', event.target.value)}
        />
      )}
    </SheetField>
  );
}

interface CheckOption {
  name: string;
  note?: string;
}

function CheckList({
  legend,
  options,
  selected,
  error,
  onChange,
}: {
  legend: string;
  options: CheckOption[];
  selected: string[];
  error?: string;
  onChange: (selected: string[]) => void;
}) {
  const names = options.map((option) => option.name);
  return (
    <fieldset className="space-y-1.5">
      <legend className="label-mono mb-2 text-fg-subtle">{legend}</legend>
      {options.length === 0 && <p className="text-xs text-fg-subtle">No hay servidores MCP configurados.</p>}
      {options.map((option) => (
        <label
          key={option.name}
          className="flex cursor-pointer items-center justify-between gap-2 border border-line bg-surface-raised px-2.5 py-1.5 font-mono text-xs text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
        >
          <span className="min-w-0 truncate">
            {option.name}
            {option.note && <span className="ml-2 text-warning">{option.note}</span>}
          </span>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-accent"
            checked={selected.includes(option.name)}
            onChange={() => onChange(toggleItem(selected, option.name, names))}
          />
        </label>
      ))}
      {error && <p className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

const mcpCheckOption = ({ name, available }: McpOption): CheckOption => ({
  name,
  note: available ? undefined : 'no disponible',
});

function CapabilityFields({ agent, form }: FieldsProps) {
  return (
    <Section title="Herramientas y servidores MCP">
      <CheckList
        legend="Herramientas"
        options={toolOptions(agent).map((name) => ({ name }))}
        selected={form.values.allowedTools}
        error={form.fieldErrors.allowedTools}
        onChange={(tools) => form.setField('allowedTools', tools)}
      />
      <CheckList
        legend="Servidores MCP"
        options={mcpOptions(agent, form.runtime.data).map(mcpCheckOption)}
        selected={form.values.mcpServers}
        error={form.fieldErrors.mcpServers}
        onChange={(servers) => form.setField('mcpServers', servers)}
      />
    </Section>
  );
}

/** Editable part of the agent sheet. */
export function AgentSheetFields(props: FieldsProps) {
  return (
    <>
      <Section title="Directiva base">
        <InstructionsInput {...props} />
      </Section>
      <ModelFields {...props} />
      <Section title="Muestreo">
        <TemperatureField {...props} />
        <MaxOutputTokensField {...props} />
      </Section>
      <CapabilityFields {...props} />
    </>
  );
}
