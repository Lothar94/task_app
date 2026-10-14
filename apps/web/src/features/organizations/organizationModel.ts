import type { OrganizationDto } from '@fleet/shared';

export const ORGANIZATION_NAME_MAX_LENGTH = 120;

/** The stored organization if it still exists, otherwise the first one (the default org comes first). */
export function resolveCurrentOrganization(
  organizations: readonly OrganizationDto[],
  storedId: string | null,
): OrganizationDto | null {
  return organizations.find((organization) => organization.id === storedId) ?? organizations[0] ?? null;
}

export type OrganizationNameResult = { name: string; error: null } | { name: null; error: string };

export function validateOrganizationName(raw: string): OrganizationNameResult {
  const name = raw.trim();
  if (name === '') return { name: null, error: 'El nombre es obligatorio.' };
  if (name.length > ORGANIZATION_NAME_MAX_LENGTH) {
    return {
      name: null,
      error: `El nombre no puede superar los ${ORGANIZATION_NAME_MAX_LENGTH} caracteres.`,
    };
  }
  return { name, error: null };
}
