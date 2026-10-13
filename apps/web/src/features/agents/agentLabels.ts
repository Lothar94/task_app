import type { AgentEffort, AgentModel, AgentPermissionMode } from '@fleet/shared';

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
