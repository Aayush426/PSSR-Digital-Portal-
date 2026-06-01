import { apiRequest, getApiBaseUrl } from './api';
import type {
  AnnexureDetail,
  AnnexureListResponse,
  AnnexureMasterPayload,
  AnnexureOverview,
  AnnexureResponse,
  SaveAnnexureResponsePayload,
} from '../types/annexure.types';
import { tokenStore } from '../utils/token';

export interface ListAnnexuresParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  active?: boolean;
  archived?: boolean;
  revision?: string;
  hasTemplate?: boolean;
  recentlyModified?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  pssrId?: string;
}

const API_BASE_URL = getApiBaseUrl();

export const annexureService = {
  list(params: ListAnnexuresParams = {}): Promise<AnnexureListResponse> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 25));
    if (params.search) query.set('search', params.search);
    if (params.department) query.set('department', params.department);
    if (typeof params.active === 'boolean') query.set('active', String(params.active));
    if (typeof params.archived === 'boolean') query.set('archived', String(params.archived));
    if (params.revision) query.set('revision', params.revision);
    if (typeof params.hasTemplate === 'boolean') query.set('has_template', String(params.hasTemplate));
    if (params.recentlyModified) query.set('recently_modified', 'true');
    if (params.sortBy) query.set('sort_by', params.sortBy);
    if (params.sortDir) query.set('sort_dir', params.sortDir);
    if (params.pssrId) query.set('pssr_id', params.pssrId);
    return apiRequest<AnnexureListResponse>(`/annexures?${query.toString()}`);
  },

  overview(): Promise<AnnexureOverview> {
    return apiRequest<AnnexureOverview>('/annexures/overview');
  },

  detail(annexureId: number, pssrId?: string): Promise<AnnexureDetail> {
    const suffix = pssrId ? `?pssr_id=${encodeURIComponent(pssrId)}` : '';
    return apiRequest<AnnexureDetail>(`/annexures/${annexureId}${suffix}`);
  },

  saveResponse(payload: SaveAnnexureResponsePayload): Promise<AnnexureResponse> {
    return apiRequest<AnnexureResponse>('/annexures/respond', {
      method: 'POST',
      body: JSON.stringify({ ...payload, attachments: payload.attachments ?? [] }),
    });
  },

  uploadTemplate(annexureId: number, version: string, file: File): Promise<Record<string, unknown>> {
    const form = new FormData();
    form.set('annexure_id', String(annexureId));
    form.set('version', version);
    form.set('file', file);
    return apiRequest<Record<string, unknown>>('/annexures/upload-template', {
      method: 'POST',
      body: form,
    });
  },

  create(payload: AnnexureMasterPayload): Promise<AnnexureDetail> {
    return apiRequest<AnnexureDetail>('/annexures', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(annexureId: number, payload: Partial<AnnexureMasterPayload>): Promise<AnnexureDetail> {
    return apiRequest<AnnexureDetail>(`/annexures/${annexureId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  archive(annexureId: number): Promise<{ id: number; archived: boolean }> {
    return apiRequest<{ id: number; archived: boolean }>(`/annexures/${annexureId}`, {
      method: 'DELETE',
    });
  },

  restore(annexureId: number): Promise<{ id: number; archived: boolean }> {
    return apiRequest<{ id: number; archived: boolean }>(`/annexures/${annexureId}/restore`, {
      method: 'POST',
    });
  },

  async downloadTemplate(annexureId: number, fileName: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/annexures/${annexureId}/download-template`, {
      headers: tokenStore.getToken() ? { Authorization: `Bearer ${tokenStore.getToken()}` } : undefined,
    });
    if (!response.ok) throw new Error('Template download failed.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
