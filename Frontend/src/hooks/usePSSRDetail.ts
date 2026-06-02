import { useQuery } from '@tanstack/react-query';
import { api, type PSSRWorkflowDetail } from '../services/api';

export function usePSSRDetail(pssrId?: string) {
  return useQuery<PSSRWorkflowDetail, Error>({
    queryKey: ['pssr-detail', pssrId],
    queryFn: () => api.getPSSR(pssrId as string),
    enabled: Boolean(pssrId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
  });
}
