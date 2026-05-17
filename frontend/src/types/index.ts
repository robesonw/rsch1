// types/index.ts — mirrors backend DTOs exactly. Keep in sync.

export type Protocol = 'IBM_MQ' | 'KAFKA' | 'SOLACE' | 'SFTP' | 'FILE' | 'DATABASE';
export type RunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED';
export type CaptureMode = 'SNAPSHOT_DURATION' | 'SNAPSHOT_COUNT' | 'CONTINUOUS';

// ── API envelope ─────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ── Projects ─────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

// ── Environments ──────────────────────────────────────────────────
export interface Environment {
  id: string;
  name: string;
  protocol: Protocol;
  host?: string;
  port?: number;
  isActive: boolean;
}

// ── Rule sets ─────────────────────────────────────────────────────
export interface RuleSetSummary {
  id: string;
  name: string;
  version: number;
  isLatest: boolean;
  fieldCount: number;
  lookupCount: number;
  usedByCount: number;
  updatedAt: string;
}

// ── Production parallels ──────────────────────────────────────────
export interface SourceBinding {
  environmentId: string;
  environmentName: string;
  protocol: Protocol;
  endpoint: string;
  filter?: string;
  captureMode: CaptureMode;
  duration?: string;
  maxMessages?: number;
  correlationKey: string;
}

export interface TargetBinding {
  environmentId: string;
  environmentName: string;
  protocol: Protocol;
  endpoint: string;
  ratePerSecond?: number;
  preserveOrder: boolean;
}

export interface ParallelSummary {
  id: string;
  name: string;
  projectId: string;
  sourceEnvironmentName: string;
  sourceProtocol: Protocol;
  targetEnvironmentName: string;
  targetProtocol: Protocol;
  ruleSetName?: string;
  lastRunStatus?: RunStatus;
  lastRunAt?: string;
  scheduleCron?: string;
}

export interface ParallelDetail extends ParallelSummary {
  description?: string;
  sourceBinding: SourceBinding;
  targetBinding: TargetBinding;
  ruleSetId?: string;
  ruleSetVersion?: number;
  inlineOverrides?: string;
  assertionSetId?: string;
  outputPullConfig?: OutputPullConfig;
  createdBy: string;
  createdAt: string;
}

export interface OutputPullConfig {
  type: 'DB_QUERY' | 'FILE';
  query?: string;
  filePath?: string;
}

// ── Runs ──────────────────────────────────────────────────────────
export interface Run {
  id: string;
  parallelId: string;
  parallelName: string;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  triggeredBy: string;
  totalRecords?: number;
  matchedRecords?: number;
  matchRate?: number;
  errorMessage?: string;
}

export interface RunResult {
  recordKey: string;
  fieldName: string;
  expectedValue?: string;
  actualValue?: string;
  matched: boolean;
  mismatchReason?: string;
}

// ── WebSocket events ──────────────────────────────────────────────
export interface StepStatusEvent {
  runId: string;
  stepType: 'CAPTURE' | 'TRANSFORM' | 'REPLAY' | 'COMPARE';
  status: RunStatus;
  message?: string;
  progressPct?: number;
  timestamp: string;
}

// ── Request types ─────────────────────────────────────────────────
export interface CreateParallelRequest {
  projectId: string;
  name: string;
  description?: string;
  sourceBinding: Omit<SourceBinding, 'environmentName'>;
  targetBinding: Omit<TargetBinding, 'environmentName'>;
  ruleSetId?: string;
  ruleSetVersion?: number;
  assertionSetId?: string;
  outputPullConfig?: OutputPullConfig;
  scheduleCron?: string;
}

export interface TriggerRunRequest {
  params?: Record<string, string>;
}
