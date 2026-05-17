// services/parallelService.ts
import api from './api';
import type {
  ApiResponse, ParallelSummary, ParallelDetail,
  CreateParallelRequest, Run, TriggerRunRequest, RunResult
} from '../types';

export const parallelService = {
  list: (projectId: string) =>
    api.get<ApiResponse<ParallelSummary[]>>(`/parallels?projectId=${projectId}`),

  getById: (id: string) =>
    api.get<ApiResponse<ParallelDetail>>(`/parallels/${id}`),

  create: (data: CreateParallelRequest) =>
    api.post<ApiResponse<ParallelDetail>>('/parallels', data),

  update: (id: string, data: Partial<CreateParallelRequest>) =>
    api.put<ApiResponse<ParallelDetail>>(`/parallels/${id}`, data),

  clone: (id: string, name: string) =>
    api.post<ApiResponse<ParallelDetail>>(`/parallels/${id}/clone`, { name }),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/parallels/${id}`),

  triggerRun: (id: string, request: TriggerRunRequest = {}) =>
    api.post<ApiResponse<Run>>(`/parallels/${id}/runs`, request),

  getRuns: (parallelId: string) =>
    api.get<ApiResponse<Run[]>>(`/parallels/${parallelId}/runs`),

  getRunResults: (runId: string, recordKey?: string) =>
    api.get<ApiResponse<RunResult[]>>(
      `/runs/${runId}/results${recordKey ? `?recordKey=${recordKey}` : ''}`
    ),
};
