/**
 * services/paralleliqService.ts
 * All API calls for the ParallelIQ UI.
 * Typed against the current API contract in paralleliq-api.
 */
import api from './api';
import type {
  ApiResponse,
  AgentRegistration,
  AssertionSetSummary,
  CreateParallelRequest,
  CreateProjectRequest,
  DashboardStats,
  Environment,
  ParallelDetail,
  ParallelSummary,
  Project,
  RecordDiff,
  Run,
  RuleSetDetail,
  RuleSetSummary,
  TriggerRunRequest,
} from '../types';

// ── Projects ──────────────────────────────────────────────────────

export const projectService = {
  list: () =>
    api.get<ApiResponse<ParallelSummary[]>>('/projects'),

  getById: (id: string) =>
    api.get<ApiResponse<Project>>(`/projects/${id}`),

  create: (data: CreateProjectRequest) =>
    api.post<ApiResponse<Project>>('/projects', data),

  dashboard: (projectId: string) =>
    api.get<ApiResponse<DashboardStats>>(`/projects/${projectId}/dashboard`),
};

// ── Environments ──────────────────────────────────────────────────

export const environmentService = {
  list: () =>
    api.get<ApiResponse<Environment[]>>('/environments'),
};

// ── Production parallels ──────────────────────────────────────────

export const parallelService = {
  list: (projectId: string, page = 0, size = 20) =>
    api.get<ApiResponse<{ content: ParallelSummary[]; totalElements: number }>>(
      `/parallels?projectId=${projectId}&page=${page}&size=${size}`
    ),

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

  getRuns: (parallelId: string, page = 0, size = 20) =>
    api.get<ApiResponse<{ content: Run[]; totalElements: number }>>(
      `/parallels/${parallelId}/runs?page=${page}&size=${size}`
    ),
};

// ── Runs ──────────────────────────────────────────────────────────

export const runService = {
  getById: (runId: string) =>
    api.get<ApiResponse<Run>>(`/runs/${runId}`),

  /**
   * Paginated list of records with mismatches.
   * recordKey filter narrows to a specific correlation key.
   */
  getResults: (runId: string, page = 0, size = 50, recordKey?: string) => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (recordKey) params.set('recordKey', recordKey);
    return api.get<ApiResponse<{ content: RecordDiff[]; totalElements: number }>>(
      `/runs/${runId}/results?${params}`
    );
  },

  exportCsv: (runId: string) =>
    api.get(`/runs/${runId}/results/export`, { responseType: 'blob' }),

  exportJunit: (runId: string) =>
    api.get(`/runs/${runId}/results/junit`, { responseType: 'blob' }),

  rerun: (runId: string) =>
    api.post<ApiResponse<Run>>(`/runs/${runId}/rerun`),
};

// ── Rule sets ─────────────────────────────────────────────────────

export const ruleSetService = {
  list: (page = 0, size = 20) =>
    api.get<ApiResponse<{ content: RuleSetSummary[]; totalElements: number }>>(
      `/rule-sets?page=${page}&size=${size}`
    ),

  getDetail: (id: string) =>
    api.get<ApiResponse<RuleSetDetail>>(`/rule-sets/${id}`),
};

// ── Assertion sets ────────────────────────────────────────────────

export const assertionSetService = {
  list: () =>
    api.get<ApiResponse<AssertionSetSummary[]>>('/assertion-sets'),
};

// ── Agent registry (read-only admin view) ─────────────────────────

export const agentService = {
  list: () =>
    api.get<ApiResponse<AgentRegistration[]>>('/admin/agents'),
};
