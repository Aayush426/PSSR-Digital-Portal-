import { apiRequest } from './api';
import type { TeamDashboardResponse } from '../types/team-dashboard.types';

export const teamDashboardService = {
  getDashboard(): Promise<TeamDashboardResponse> {
    return apiRequest<TeamDashboardResponse>('/team/dashboard');
  },
};
