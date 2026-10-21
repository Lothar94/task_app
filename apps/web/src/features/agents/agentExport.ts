import type { AgentExportDto } from '@fleet/shared';
import { downloadFile } from '../../lib/download';

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function exportFileName(bundle: AgentExportDto): string {
  const single = bundle.agents.length === 1 ? slugify(bundle.agents[0]?.name ?? '') : '';
  if (single) return `${single}.json`;
  const organization = slugify(bundle.organization) || 'organizacion';
  return `agents-${organization}-${bundle.exportedAt.slice(0, 10)}.json`;
}

export const downloadJson = (fileName: string, data: unknown): void =>
  downloadFile(fileName, JSON.stringify(data, null, 2), 'application/json');
