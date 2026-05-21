import { useQuery } from '@tanstack/react-query';
import { teamDashboardService } from '../services/teamDashboardService';
import type { TeamDashboardResponse } from '../types/team-dashboard.types';

export function useTeamMemberDashboard() {
  return useQuery<TeamDashboardResponse, Error>({
    queryKey: ['team-member-dashboard'],
    queryFn: () => teamDashboardService.getDashboard(),
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}
