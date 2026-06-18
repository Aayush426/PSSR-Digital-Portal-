/**
 * Cached, server-paginated user directory hook.
 *
 * The hook delegates server state to TanStack Query instead of hand-rolled
 * component state. This gives the portal page-level caching, retry behavior,
 * background refetch, and request de-duplication, which are mandatory for
 * enterprise grids backed by large personnel datasets.
 */

import { useQuery } from '@tanstack/react-query';
import { api, type ListUsersParams, type PaginatedUsersResponse } from '../services/api';

export function useAdminUsers(params: ListUsersParams) {
  return useQuery<PaginatedUsersResponse, Error>({
    queryKey: ['admin-users', params],
    queryFn: () => api.listUsers(params),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
