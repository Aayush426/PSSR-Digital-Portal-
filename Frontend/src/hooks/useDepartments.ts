import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type DepartmentPermissionConfig,
  type DepartmentUsersResponse,
  type DepartmentWorkflowResponsibility,
  type DepartmentsResponse,
  type RefineryDepartment,
  type Role,
  type UpdateUserPayload,
} from '../services/api';

export function useDepartments(params: { page?: number; limit?: number; search?: string; active?: boolean }) {
  return useQuery<DepartmentsResponse, Error>({
    queryKey: ['departments', params],
    queryFn: () => api.listDepartments(params),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createDepartment,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Pick<RefineryDepartment, 'code' | 'name' | 'description' | 'active'>> & { unit_ids?: number[] } }) =>
      api.updateDepartment(id, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteDepartment,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useDepartmentUsers(departmentId: number | null, params: { page?: number; limit?: number; search?: string; role?: Role; active?: boolean; initiator?: boolean; plant_area?: string }) {
  return useQuery<DepartmentUsersResponse, Error>({
    queryKey: ['department-users', departmentId, params],
    queryFn: () => api.listDepartmentUsers(departmentId as number, params),
    enabled: departmentId !== null,
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 1000,
  });
}

export function useUpdateDepartmentUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UpdateUserPayload }) => api.updateUser(userId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['department-users'] });
      void queryClient.invalidateQueries({ queryKey: ['departments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useSetDepartmentUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, active, reason }: { userId: number; active: boolean; reason?: string }) => api.setUserStatus(userId, active, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['department-users'] });
      void queryClient.invalidateQueries({ queryKey: ['departments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useSoftDeleteDepartmentUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['department-users'] });
      void queryClient.invalidateQueries({ queryKey: ['departments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

export function useResetDepartmentUserPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason?: string }) => api.resetUserPermissions(userId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['department-users'] });
      void queryClient.invalidateQueries({ queryKey: ['pssr-initiators'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

function invalidateDepartmentConfiguration(queryClient: ReturnType<typeof useQueryClient>) {
  // Department orchestration changes affect creation selectors, assigned work,
  // routing, and dashboard rollups, so related query families refresh together.
  void queryClient.invalidateQueries({ queryKey: ['departments'] });
  void queryClient.invalidateQueries({ queryKey: ['department-users'] });
  void queryClient.invalidateQueries({ queryKey: ['pssr-records'] });
}

export function useConfigureDepartmentAnnexure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.configureDepartmentAnnexure>[1] }) =>
      api.configureDepartmentAnnexure(id, payload),
    onSuccess: () => invalidateDepartmentConfiguration(queryClient),
  });
}

export function useRemoveDepartmentAnnexure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mappingId }: { id: number; mappingId: number }) => api.removeDepartmentAnnexure(id, mappingId),
    onSuccess: () => invalidateDepartmentConfiguration(queryClient),
  });
}

export function useConfigureDepartmentUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.configureDepartmentUnit>[1] }) => api.configureDepartmentUnit(id, payload),
    onSuccess: () => invalidateDepartmentConfiguration(queryClient),
  });
}

export function useConfigureDepartmentWorkflowResponsibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, responsibilityId }: { id: number; payload: Omit<DepartmentWorkflowResponsibility, 'id'>; responsibilityId?: number }) =>
      api.configureDepartmentWorkflowResponsibility(id, payload, responsibilityId),
    onSuccess: () => invalidateDepartmentConfiguration(queryClient),
  });
}

export function useConfigureDepartmentPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Omit<DepartmentPermissionConfig, 'id'> }) =>
      api.configureDepartmentPermission(id, payload),
    onSuccess: () => invalidateDepartmentConfiguration(queryClient),
  });
}

export function useConfigureDepartmentAreaOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload, mappingId }: { id: number; payload: Parameters<typeof api.configureDepartmentAreaOwner>[1]; mappingId?: number }) =>
      api.configureDepartmentAreaOwner(id, payload, mappingId),
    onSuccess: () => invalidateDepartmentConfiguration(queryClient),
  });
}
