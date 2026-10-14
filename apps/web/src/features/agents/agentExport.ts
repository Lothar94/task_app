import type { AgentExportDto } from '@fleet/shared';

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

export function downloadJson(fileName: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
