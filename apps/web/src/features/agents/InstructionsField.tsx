import { useState } from 'react';
import { Markdown } from '../../components/Markdown';
import { Button, EmptyState, ErrorMessage, Field, SegmentedControl, TextArea } from '../../components/ui';
import { type AgentFormValues, canDraftInstructions, toInstructionsBrief } from './agentFormModel';
import { useDraftInstructions } from './agentQueries';

interface InstructionsFieldProps {
  values: AgentFormValues;
  isNew: boolean;
  onInstructionsChange: (instructions: string) => void;
  onGuidanceChange: (guidance: string) => void;
}

type EditorMode = 'edit' | 'preview';
const MODE_OPTIONS = [
  { value: 'edit' as const, label: 'Editar' },
  { value: 'preview' as const, label: 'Vista previa' },
];

const GUIDANCE_PLACEHOLDER =
  'Opcional. Ej.: «Usa TypeScript estricto y Vitest», «Prioriza la accesibilidad», «Responde siempre en español», «Antes de entregar, pide revisión a QA»…';

function GuidancePanel(props: {
  values: AgentFormValues;
  isGenerating: boolean;
  error: unknown;
  onGuidanceChange: (guidance: string) => void;
  onGenerate: () => void;
}) {
  const { values, isGenerating, error, onGuidanceChange, onGenerate } = props;
  const isReady = canDraftInstructions(values);
  return (
    <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
      <Field
        label="Indicaciones para Claude"
        hint="Se añaden al nombre, rol, herramientas y colaboradores para orientar la redacción."
      >
        <TextArea
          rows={3}
          placeholder={GUIDANCE_PLACEHOLDER}
          value={values.instructionsGuidance}
          onChange={(e) => onGuidanceChange(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">
          {isReady
            ? 'Claude propondrá unas instrucciones que podrás editar.'
            : 'Rellena nombre y rol para poder generarlas.'}
        </span>
        <Button type="button" variant="secondary" onClick={onGenerate} disabled={!isReady || isGenerating}>
          {isGenerating ? 'Redactando…' : '✨ Generar con Claude'}
        </Button>
      </div>
      <ErrorMessage error={error} />
    </div>
  );
}

/** Instructions editor with Markdown preview that can ask Claude for a draft. */
export function InstructionsField({
  values,
  isNew,
  onInstructionsChange,
  onGuidanceChange,
}: InstructionsFieldProps) {
  const draft = useDraftInstructions();
  const [mode, setMode] = useState<EditorMode>('edit');

  const generate = () => {
    if (
      values.instructions.trim() &&
      !confirm('¿Reemplazar las instrucciones actuales por una propuesta nueva?')
    )
      return;
    draft.mutate(toInstructionsBrief(values), {
      onSuccess: ({ instructions }) => {
        onInstructionsChange(instructions);
        setMode('preview');
      },
    });
  };

  const hint = isNew
    ? 'Si lo dejas vacío, Claude las redacta al crear el agente usando su perfil y tus indicaciones.'
    : 'Se añaden al prompt de Claude Code de este agente. Admiten Markdown.';

  return (
    <div className="space-y-4">
      <GuidancePanel
        values={values}
        isGenerating={draft.isPending}
        error={draft.error}
        onGuidanceChange={onGuidanceChange}
        onGenerate={generate}
      />
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            Prompt de sistema
          </span>
          <SegmentedControl label="Modo del editor" options={MODE_OPTIONS} value={mode} onChange={setMode} />
        </div>
        {mode === 'edit' ? (
          <>
            <TextArea
              aria-label="Prompt de sistema"
              required={!isNew}
              rows={14}
              disabled={draft.isPending}
              value={values.instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
            />
            <p className="text-xs text-zinc-500">{hint}</p>
          </>
        ) : values.instructions.trim() ? (
          <div className="max-h-[32rem] overflow-auto rounded-md border border-zinc-700 bg-zinc-900 p-4">
            <Markdown>{values.instructions}</Markdown>
          </div>
        ) : (
          <EmptyState>Aún no hay instrucciones. {hint}</EmptyState>
        )}
      </div>
    </div>
  );
}
