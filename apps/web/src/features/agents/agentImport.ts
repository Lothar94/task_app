import {
  AGENT_EXPORT_FORMAT,
  AGENT_EXPORT_VERSION,
  MAX_IMPORTED_AGENTS,
  MODEL_SELECTION_MODES,
  type ExportedAgent,
  type ModelSelectionMode,
  type AgentExportDto,
} from '@fleet/shared';

export type ParsedImport = { ok: true; file: AgentExportDto } | { ok: false; error: string };

const fail = (error: string): ParsedImport => ({ ok: false, error });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Files exported before automatic selection existed carry no mode: they are fixed agents. */
const modelSelectionOf = (value: unknown): ModelSelectionMode =>
  MODEL_SELECTION_MODES.find((mode) => mode === value) ?? 'fixed';

const withModelSelection = (agent: ExportedAgent): ExportedAgent => ({
  ...agent,
  modelSelection: modelSelectionOf(agent.modelSelection),
});

export function parseImportFile(text: string): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail('El fichero no es un JSON válido.');
  }
  if (!isRecord(data) || data.format !== AGENT_EXPORT_FORMAT) {
    return fail('El fichero no es una exportación de agentes.');
  }
  if (data.version !== AGENT_EXPORT_VERSION) {
    return fail(`Versión de exportación no soportada (se espera la ${AGENT_EXPORT_VERSION}).`);
  }
  if (!Array.isArray(data.agents) || data.agents.length === 0) {
    return fail('El fichero no contiene agentes.');
  }
  if (data.agents.length > MAX_IMPORTED_AGENTS) {
    return fail(`El fichero tiene demasiados agentes (máximo ${MAX_IMPORTED_AGENTS}).`);
  }
  const invalidAt = data.agents.findIndex((agent) => !isRecord(agent) || typeof agent.name !== 'string');
  if (invalidAt >= 0) return fail(`El agente nº ${invalidAt + 1} no tiene un nombre válido.`);
  const file = data as unknown as AgentExportDto;
  return { ok: true, file: { ...file, agents: file.agents.map(withModelSelection) } };
}

/** Names in the file that already exist in the organization (exact match after trimming). */
export function findNameConflicts(file: AgentExportDto, existingNames: string[]): string[] {
  const existing = new Set(existingNames.map((name) => name.trim()));
  return file.agents.map((agent) => agent.name).filter((name) => existing.has(name.trim()));
}

export async function readImportFile(file: File): Promise<ParsedImport> {
  try {
    return parseImportFile(await file.text());
  } catch {
    return fail('No se pudo leer el fichero. Inténtalo de nuevo.');
  }
}
