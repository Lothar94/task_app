import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { shellApi } from '../../api/shellApi';
import { queryKeys } from '../../api/queryKeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCurrentOrganization } from '../organizations/OrganizationContext';

export const SEARCH_DEBOUNCE_MS = 150;

/**
 * Server-side search of the current organization while the user types: debounced, only for a
 * non-empty query, keeping the previous results on screen until the new ones arrive.
 */
export function useGlobalSearch(query: string) {
  const { id: organizationId } = useCurrentOrganization();
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const search = useQuery({
    queryKey: queryKeys.search(organizationId, debounced),
    queryFn: () => shellApi.search(organizationId, debounced),
    enabled: debounced !== '',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  return {
    results: search.data,
    isLoading: trimmed !== debounced || search.isPlaceholderData || search.isLoading,
    error: search.error,
  };
}
