import { useQuery } from '@tanstack/react-query';
import { areaOwnerDashboardService } from '../services/areaOwnerDashboardService';
import type { AreaOwnerDashboardResponse } from '../types/area-owner-dashboard.types';

export function useAreaOwnerDashboard() {
  return useQuery<AreaOwnerDashboardResponse, Error>({
    queryKey: ['area-owner-dashboard'],
    queryFn: () => areaOwnerDashboardService.getDashboard(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
    retry: 2,
  });
}
