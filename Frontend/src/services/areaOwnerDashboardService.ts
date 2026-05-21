import { apiRequest } from './api';
import type { AreaOwnerDashboardResponse } from '../types/area-owner-dashboard.types';

export const areaOwnerDashboardService = {
  getDashboard(): Promise<AreaOwnerDashboardResponse> {
    return apiRequest<AreaOwnerDashboardResponse>('/area-owner/dashboard');
  },
};
