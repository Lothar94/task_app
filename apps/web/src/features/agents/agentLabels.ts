import type {
  AgentDto,
  AgentEffort,
  AgentModel,
  AgentPermissionMode,
  ModelSelectionMode,
} from '@fleet/shared';

export const MODEL_LABELS: Record<AgentModel, string> = {
  opus: 'Opus — razonamiento profundo',
  sonnet: 'Sonnet — equilibrado',
  haiku: 'Haiku — rápido',
};

export const EFFORT_LABELS: Record<AgentEffort, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  xhigh: 'Muy alta',
  max: 'Máxima',
};

export const PERMISSION_LABELS: Record<AgentPermissionMode, string> = {
  dontAsk: 'Solo herramientas permitidas',
  acceptEdits: 'Herramientas permitidas + editar ficheros',
  bypassPermissions: 'Sin restricciones (peligroso)',
};

export const MODEL_SELECTION_LABELS: Record<ModelSelectionMode, string> = {
  fixed: 'Fija',
  auto: 'Automática',
};

export const AUTO_SELECTION_HINT =
  'Quien invoca al agente elige modelo y esfuerzo según la dificultad de la tarea; estos valores se usan si no elige.';

/** Model and effort field labels: for auto agents they are only the fallback. */
export const modelFieldLabels = (selection: ModelSelectionMode) =>
  selection === 'auto'
    ? { model: 'Modelo por defecto', effort: 'Esfuerzo por defecto' }
    : { model: 'Modelo', effort: 'Intensidad' };

/** Model as shown in agent views; auto agents get an "Auto" marker and their model is the default. */
export const modelText = ({ model, modelSelection }: Pick<AgentDto, 'model' | 'modelSelection'>) =>
  modelSelection === 'auto' ? `Auto · ${model} por defecto` : model;

/** Model and effort on one line, e.g. "sonnet · alta" or "Auto · sonnet por defecto · alta". */
export const modelEffortText = (agent: Pick<AgentDto, 'model' | 'effort' | 'modelSelection'>) =>
  `${modelText(agent)} · ${EFFORT_LABELS[agent.effort].toLowerCase()}`;
