import { useQuery } from '@tanstack/react-query';
import { api, type PaginatedUsersResponse } from '../services/api';

export function useTeamDirectory(params: { page?: number; limit?: number; search?: string; department?: string; includeAllRoles?: boolean }) {
  return useQuery<PaginatedUsersResponse, Error>({
    queryKey: ['team-directory', params],
    queryFn: () => api.listTeamDirectory(params),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
