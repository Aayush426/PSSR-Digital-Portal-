import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type InitiatorCapabilitiesResponse } from '../services/api';

export function usePSSRInitiators(params: { active?: boolean; department?: string; search?: string; page?: number; limit?: number }) {
  return useQuery<InitiatorCapabilitiesResponse, Error>({
    queryKey: ['pssr-initiators', params],
    queryFn: () => api.listInitiators(params),
    staleTime: 60 * 1000,
  });
}

export function useEnableInitiator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason?: string }) => api.enableInitiator(userId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pssr-initiators'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['department-users'] });
      void queryClient.invalidateQueries({ queryKey: ['team-member-dashboard'] });
    },
  });
}

export function useDisableInitiator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason?: string }) => api.disableInitiator(userId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pssr-initiators'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['department-users'] });
      void queryClient.invalidateQueries({ queryKey: ['team-member-dashboard'] });
    },
  });
}
