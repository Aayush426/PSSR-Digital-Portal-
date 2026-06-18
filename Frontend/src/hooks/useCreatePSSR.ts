import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CreatePSSRPayload, type PSSRWorkflowDetail } from '../services/api';

export function useCreatePSSR() {
  const queryClient = useQueryClient();
  return useMutation<PSSRWorkflowDetail, Error, CreatePSSRPayload>({
    mutationFn: (payload) => api.createPSSR(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-member-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['pssr-records'] });
    },
  });
}
