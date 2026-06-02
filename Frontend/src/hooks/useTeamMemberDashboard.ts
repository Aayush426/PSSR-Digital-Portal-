import { useQuery } from '@tanstack/react-query';
import { teamDashboardService } from '../services/teamDashboardService';
import type { TeamDashboardResponse } from '../types/team-dashboard.types';

export function useTeamMemberDashboard() {
  return useQuery<TeamDashboardResponse, Error>({
    queryKey: ['team-member-dashboard'],
    queryFn: () => teamDashboardService.getDashboard(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
    retry: 2,
  });
}
