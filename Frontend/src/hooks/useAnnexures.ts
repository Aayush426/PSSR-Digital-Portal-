import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { annexureService, type ListAnnexuresParams } from '../services/annexureService';
import type { AnnexureMasterPayload, SaveAnnexureResponsePayload } from '../types/annexure.types';

export function useAnnexures(params: ListAnnexuresParams) {
  return useQuery({
    queryKey: ['annexures', params],
    queryFn: () => annexureService.list(params),
  });
}

export function useAnnexureDetail(annexureId?: number, pssrId?: string) {
  return useQuery({
    queryKey: ['annexure-detail', annexureId, pssrId],
    queryFn: () => annexureService.detail(annexureId as number, pssrId),
    enabled: Boolean(annexureId),
  });
}

export function useAnnexureOverview() {
  return useQuery({
    queryKey: ['annexure-overview'],
    queryFn: () => annexureService.overview(),
  });
}

export function useCreateAnnexure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AnnexureMasterPayload) => annexureService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annexures'] });
      queryClient.invalidateQueries({ queryKey: ['annexure-overview'] });
    },
  });
}

export function useUpdateAnnexure(annexureId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AnnexureMasterPayload>) => annexureService.update(annexureId as number, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annexures'] });
      queryClient.invalidateQueries({ queryKey: ['annexure-overview'] });
      queryClient.invalidateQueries({ queryKey: ['annexure-detail', annexureId, undefined] });
    },
  });
}

export function useArchiveAnnexure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (annexureId: number) => annexureService.archive(annexureId),
    onMutate: async (annexureId) => {
      await queryClient.cancelQueries({ queryKey: ['annexures'] });
      const previous = queryClient.getQueriesData({ queryKey: ['annexures'] });
      queryClient.setQueriesData({ queryKey: ['annexures'] }, (old: any) => {
        if (!old?.records) return old;
        return { ...old, records: old.records.filter((item: any) => item.id !== annexureId) };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, value]) => queryClient.setQueryData(key, value));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['annexures'] });
      queryClient.invalidateQueries({ queryKey: ['annexure-overview'] });
    },
  });
}

export function useRestoreAnnexure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (annexureId: number) => annexureService.restore(annexureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annexures'] });
      queryClient.invalidateQueries({ queryKey: ['annexure-overview'] });
    },
  });
}

export function useUploadAnnexureTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ annexureId, version, file }: { annexureId: number; version: string; file: File }) =>
      annexureService.uploadTemplate(annexureId, version, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['annexures'] });
      queryClient.invalidateQueries({ queryKey: ['annexure-overview'] });
      queryClient.invalidateQueries({ queryKey: ['annexure-detail', variables.annexureId, undefined] });
    },
  });
}

export function useSaveAnnexureResponse(pssrId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveAnnexureResponsePayload) => annexureService.saveResponse(payload),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['annexures'] });
      queryClient.invalidateQueries({ queryKey: ['annexure-detail', variables.annexure_id, pssrId] });
    },
  });
}
