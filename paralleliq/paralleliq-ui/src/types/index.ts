/**
 * types/index.ts
 *
 * TypeScript interfaces mirroring paralleliq-common DTOs exactly.
 * Keep in sync with:
 *   paralleliq-common/src/main/java/com/paralleliq/common/dto/AgentDtos.java
 *   paralleliq-common/src/main/java/com/paralleliq/common/model/
 *
 * Rule: if a field is added to a Java DTO, add it here too.
 */

// ── Enums (mirror paralleliq-common/model) ────────────────────────

export type Protocol =
  | 'IBM_MQ'
  | 'KAFKA'
  | 'SOLACE'
  | 'SFTP'
  | 'FILE'
  | 'DATABASE';

/**
 * Mode 1 — REPLAY_VALIDATE: capture Env A, replay to Env B, compare.
 * Mode 2 — TRUE_PARALLEL:   inject to both envs simultaneously, reconcile.
 */
export type ExecutionMode = 'REPLAY_VALIDATE' | 'TRUE_PARALLEL';

export type RunStatus =
  | 'QUEUED'
  | 'PICKED_UP'    // agent has claimed this run
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'CANCELLED';

export type CaptureMode =
  | 'SNAPSHOT_DURATION'
  | 'SNAPSHOT_COUNT'
  | 'CONTINUOUS';

export type OutputPullType = 'DB_QUERY' | 'FILE';

export type EnvironmentRole = 'ENV_A' | 'ENV_B';

// ── API envelope ──────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ── Projects ──────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

// ── Environments (admin-managed) ──────────────────────────────────

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
  createdBy: string;
  updatedAt: string;
}

export interface FieldRulePreview {
  sourceField: string;
  targetField: string;
  ruleType: 'DIRECT' | 'DATE_FORMAT' | 'LOOKUP' | 'ENV_SWAP' | 'REGEX_EXTRACT' | 'CONCAT' | 'STATIC';
  ruleDetail?: string; // e.g. "lookup: products" or "date → yyyy-MM-dd"
}

export interface RuleSetDetail extends RuleSetSummary {
  fieldRules: FieldRulePreview[];
}

// ── Assertion sets ────────────────────────────────────────────────

export interface AssertionSetSummary {
  id: string;
  name: string;
  version: number;
  isLatest: boolean;
  fieldCount: number;
}

// ── Source & target bindings ──────────────────────────────────────

export interface SourceBinding {
  environmentId: string;
  environmentName: string;
  protocol: Protocol;
  endpoint: string;
  filter?: string;
  captureMode: CaptureMode;
  durationSeconds?: number;
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

export interface OutputPullConfig {
  type: OutputPullType;
  query?: string;
  filePath?: string;
}

// ── Production parallels ──────────────────────────────────────────

export interface ParallelSummary {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  executionMode: ExecutionMode;           // REPLAY_VALIDATE | TRUE_PARALLEL
  sourceEnvironmentName: string;
  sourceProtocol: Protocol;
  targetEnvironmentName: string;
  targetProtocol: Protocol;
  ruleSetName?: string;
  ruleSetVersion?: number;
  lastRunStatus?: RunStatus;
  lastRunAt?: string;
  matchRate?: number;
  scheduleCron?: string;
  createdBy: string;
  createdAt: string;
}

export interface ParallelDetail extends ParallelSummary {
  sourceBinding: SourceBinding;
  targetBinding: TargetBinding;
  ruleSetId?: string;
  inlineOverrides?: string;
  assertionSetId?: string;
  assertionSetVersion?: number;
  outputPullConfig?: OutputPullConfig;
}

// ── Wizard form data ──────────────────────────────────────────────
// One interface per wizard step — composed into CreateParallelRequest on submit.

export interface WizardStep1 {
  name: string;
  projectId: string;
  description?: string;
  executionMode: ExecutionMode;
}

export interface WizardStep2Source {
  environmentId: string;
  protocol: Protocol;
  endpoint: string;
  filter?: string;
  captureMode: CaptureMode;
  durationSeconds?: number;
  maxMessages?: number;
  correlationKey: string;
}

export interface WizardStep3Transform {
  ruleSetId?: string;
  ruleSetVersion?: number;    // undefined = always latest
  inlineOverrides?: string;
}

export interface WizardStep4Target {
  environmentId: string;
  protocol: Protocol;
  endpoint: string;
  ratePerSecond?: number;
  preserveOrder: boolean;
}

export interface WizardStep5OutputPull {
  outputPullConfig?: OutputPullConfig;
}

export interface WizardStep6Assertions {
  assertionSetId?: string;
  assertionSetVersion?: number;
}

export interface WizardStep7Schedule {
  scheduleCron?: string;
}

export interface CreateParallelRequest {
  name: string;
  projectId: string;
  description?: string;
  executionMode: ExecutionMode;
  sourceBinding: Omit<SourceBinding, 'environmentName'>;
  ruleSetId?: string;
  ruleSetVersion?: number;
  inlineOverrides?: string;
  targetBinding: Omit<TargetBinding, 'environmentName'>;
  outputPullConfig?: OutputPullConfig;
  assertionSetId?: string;
  scheduleCron?: string;
}

export interface TriggerRunRequest {
  params?: Record<string, string>;
}

// ── Runs ──────────────────────────────────────────────────────────

export interface Run {
  id: string;
  parallelId: string;
  parallelName: string;
  executionMode: ExecutionMode;
  status: RunStatus;
  agentId?: string;
  startedAt?: string;
  completedAt?: string;
  triggeredBy: string;
  totalRecords?: number;
  matchedRecords?: number;
  matchRate?: number;
  errorMessage?: string;
}

// ── Run results ───────────────────────────────────────────────────

export interface RunResult {
  recordKey: string;
  fieldName: string;
  expectedValue?: string;
  actualValue?: string;
  matched: boolean;
  mismatchReason?: string;
  /**
   * ENV_B for REPLAY_VALIDATE runs (actual output from Env B).
   * ENV_A or ENV_B for TRUE_PARALLEL runs (both captured independently).
   */
  environmentRole: EnvironmentRole;
}

/** All results for one correlation key (one record) */
export interface RecordDiff {
  recordKey: string;
  allMatched: boolean;
  mismatchCount: number;
  fields: RunResult[];
}

// ── Agent registration (read-only in UI) ─────────────────────────

export interface AgentRegistration {
  agentId: string;
  hostname: string;
  supportedProtocols: Protocol[];
  version?: string;
  lastSeenAt: string;
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

// ── Dashboard ─────────────────────────────────────────────────────

export interface DashboardStats {
  activeParallels: number;
  avgMatchRateToday: number;
  failedThisWeek: number;
  totalRunsToday: number;
  recentRuns: Run[];
}
