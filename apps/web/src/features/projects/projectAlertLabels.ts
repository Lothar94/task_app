import type { ProjectAlertDto, ProjectAlertKind } from '@fleet/shared';
import { formatInteger } from '../../lib/format';

export const ALERT_CHIP_LABELS: Record<ProjectAlertKind, string> = {
  session_limit: 'Límite de sesión',
  token_limit: 'Límite de tokens',
};

const ALERT_REASONS: Record<ProjectAlertKind, string> = {
  session_limit: 'fallo de sesión',
  token_limit: 'límite de tokens',
};

/** "1 tarea con fallo de sesión", "2 tareas con límite de tokens". */
export function alertText(alert: ProjectAlertDto): string {
  const count = alert.taskIds.length;
  return `${formatInteger(count)} ${count === 1 ? 'tarea' : 'tareas'} con ${ALERT_REASONS[alert.kind]}`;
}
