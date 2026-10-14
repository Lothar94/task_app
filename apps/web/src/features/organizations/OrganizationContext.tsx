import type { OrganizationDto } from '@fleet/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ErrorMessage, Loading } from '../../components/ui';
import { resolveCurrentOrganization } from './organizationModel';
import { useOrganizations } from './organizationQueries';

const STORAGE_KEY = 'fleet.organization';

interface OrganizationContextValue {
  organizations: OrganizationDto[];
  current: OrganizationDto;
  selectOrganization: (id: string) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable: the choice only lasts for this session.
  }
}

/** Loads the organizations and keeps track of the current one, remembered in this browser. */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const organizations = useOrganizations();
  const [storedId, setStoredId] = useState(readStoredId);
  const selectOrganization = useCallback((id: string) => {
    setStoredId(id);
    storeId(id);
  }, []);

  const current = resolveCurrentOrganization(organizations.data ?? [], storedId);
  const value = useMemo(
    () =>
      current && organizations.data
        ? { organizations: organizations.data, current, selectOrganization }
        : null,
    [current, organizations.data, selectOrganization],
  );

  if (organizations.isPending) return <Loading />;
  if (organizations.error) return <ErrorMessage error={organizations.error} />;
  if (!value) return <ErrorMessage error="No hay ninguna organización." />;
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganizationContext(): OrganizationContextValue {
  const value = useContext(OrganizationContext);
  if (!value) throw new Error('useOrganizationContext must be used inside OrganizationProvider');
  return value;
}

export const useCurrentOrganization = () => useOrganizationContext().current;

/** Detail pages address global ids: make the organization of the shown resource the current one. */
export function useSyncOrganization(resourceOrganizationId: string | undefined): boolean {
  const { current, selectOrganization } = useOrganizationContext();
  const needsSwitch = resourceOrganizationId !== undefined && resourceOrganizationId !== current.id;
  useEffect(() => {
    if (needsSwitch) selectOrganization(resourceOrganizationId);
  }, [needsSwitch, resourceOrganizationId, selectOrganization]);
  return !needsSwitch;
}
