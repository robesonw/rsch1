# ParallelIQ — Product Roadmap

Each milestone is a self-contained deliverable. Within each milestone, epics are ordered by dependency — implement them top to bottom. Every epic ends with passing tests and a working UI.

Use this file with Copilot: reference a specific epic as a prompt, e.g.:
> "Implement epic M1-E2 from #file:docs/roadmap.md following all instructions in .github/"

---

## Milestone 1 — Foundation (Weeks 1–4)
**Goal:** A running application that can create, save, and trigger a production parallel end-to-end, with results persisted.

---

### M1-E1: Project & Environment Management

**What to build:**
- `Project` domain model, JPA entity, repository, application service
- `Environment` domain model, JPA entity, repository, application service
- REST: `GET/POST /api/v1/projects`, `GET /api/v1/projects/{id}`
- REST: `GET/POST /api/v1/environments` (ADMIN role only), `GET /api/v1/environments/{id}`
- Frontend: Project list page, create project form, environment list (admin section)

**Acceptance criteria:**
- Admin can create a named environment with protocol, host, and a `credentialRef`
- Tester can create a project and see it in the list
- ArchUnit tests pass (layers respected)
- Unit tests for `ProjectService` and `EnvironmentService`

**Copilot prompt:**
> "Implement epic M1-E1 from roadmap.md. Build the Project and Environment domain models, JPA entities, repositories, application services, REST controllers, and React pages. Follow backend.instructions.md, scalability.instructions.md, and observability.instructions.md. All list endpoints must be paginated."

---

### M1-E2: Rule Set Management

**What to build:**
- `RuleSet` domain model with versioning logic
- `FieldRule` sealed interface with implementations: `DirectRule`, `DateFormatRule`, `EnvSwapRule`, `DerivedRule`
- JPA entity + repository with `is_latest` management
- Application service: `createRuleSet`, `saveNewVersion`, `findLatest`, `findByVersion`
- REST: full CRUD + `POST /api/v1/rule-sets/{id}/versions` (creates new version)
- Frontend: Rule set list, rule set detail with field mapping preview table

**Acceptance criteria:**
- Saving a rule set with the same name creates a new version and flips `is_latest`
- Old versions are retrievable by version number
- A `ProductionParallel` can pin to a specific version or float to latest
- Unit tests for version management logic

**Copilot prompt:**
> "Implement epic M1-E2 from roadmap.md. Build versioned RuleSet management including the FieldRule sealed interface hierarchy, version increment logic, and the REST API. The RuleSet domain model must have zero Spring imports. All list endpoints paginated."

---

### M1-E3: Lookup Definition Management

**What to build:**
- `LookupDefinition` domain model (types: `DB_QUERY`, `REF_FILE`, `STATIC`)
- JPA entity + repository
- `LookupPort` interface with `lookup(definitionName, key)` → `Optional<String>`
- `CachedLookupAdapter` implementing `LookupPort` — wraps DB/file/static resolution with Caffeine TTL cache
- REST: CRUD for lookup definitions
- Frontend: Lookup definition list and create form

**Acceptance criteria:**
- DB_QUERY lookups execute a parameterised SQL query against the configured data source
- REF_FILE lookups load a CSV key-value file and cache it
- Cache hit/miss metrics emitted (`paralleliq.cache.hits`, `paralleliq.cache.misses`)
- Cache refresh works without restarting the application

**Copilot prompt:**
> "Implement epic M1-E3 from roadmap.md. Build LookupDefinition management with the CachePort/CaffeineCacheAdapter pattern from scalability.instructions.md. Emit cache metrics per observability.instructions.md."

---

### M1-E4: Assertion Set Management

**What to build:**
- `AssertionSet` domain model with versioning (same pattern as RuleSet)
- `FieldAssertion` types: `ExactMatch`, `NumericTolerance`, `RegexMatch`, `Ignore`
- JPA entity + repository
- REST: CRUD + versioning endpoint
- Frontend: Assertion set list and field assertion editor

**Acceptance criteria:**
- All four assertion types configurable per field
- Versioning works identically to RuleSet
- Unit tests for each assertion type evaluation

---

### M1-E5: Production Parallel CRUD

**What to build:**
- `ProductionParallel` domain model — references Environment, RuleSet, AssertionSet by ID
- `SourceBinding` and `TargetBinding` value objects
- JPA entity (JSON columns for binding configs)
- Application service: `create`, `update`, `clone`, `delete`, `findById`, `list`
- REST: full CRUD + `POST /api/v1/parallels/{id}/clone`
- Frontend: Parallel list page (table with status badges), 7-step wizard (all steps as forms)
- Wizard step components: `NameStep`, `SourceBindingStep`, `TransformStep`, `TargetBindingStep`, `OutputPullStep`, `AssertionStep`, `ReviewStep`

**Acceptance criteria:**
- Clone creates a new parallel with "(copy)" appended to name, preserving all config
- Wizard validates each step before allowing Next
- Rule set preview loads and displays field mappings in step 3
- All RBAC rules enforced (tester can create, admin can configure environments)

**Copilot prompt:**
> "Implement epic M1-E5 from roadmap.md. Build the full ProductionParallel CRUD including the 7-step wizard in React. Each wizard step is a separate component in components/wizard/steps/. Use React Hook Form + Zod for each step. Follow frontend.instructions.md."

---

### M1-E6: Run Engine — Core Execution

**What to build:**
- `Run` domain model with state machine: `QUEUED → RUNNING → PASSED/FAILED/CANCELLED`
- `StepExecutionEngine` — `ThreadPoolTaskExecutor` with virtual threads, dispatches steps concurrently where deps allow
- `RunOrchestrationService.triggerRun()` — creates Run record, submits async
- Step executors: `TransformStepExecutor`, `CaptureStepExecutor`, `ReplayStepExecutor`, `CompareStepExecutor`
- `RunProgressPublisher` — publishes `StepStatusEvent` over WebSocket
- REST: `POST /api/v1/parallels/{id}/runs`, `GET /api/v1/runs/{id}`, `GET /api/v1/runs/{id}/status`
- Run metrics: `paralleliq.run.duration`, `paralleliq.run.completed`

**Acceptance criteria:**
- Triggering a run returns immediately with run ID and status QUEUED
- Steps execute in correct order; independent steps run concurrently
- Run status transitions are atomic (optimistic locking on `runs` table)
- If the application restarts, RUNNING runs are marked FAILED on startup
- Timer and counter metrics are emitted on each run completion

**Copilot prompt:**
> "Implement epic M1-E6 from roadmap.md. Build the StepExecutionEngine using Java 21 virtual threads per scalability.instructions.md section 5. The HTTP response must return immediately — execution is fully async. Add run duration Timer and completion Counter metrics per observability.instructions.md."

---

### M1-E7: Results & Field Diff View

**What to build:**
- `RunResult` domain model (per-field comparison result)
- `CompareStepExecutor` — loads expected from output pull config, compares field-by-field using AssertionSet
- Bulk insert of `run_results` (JdbcTemplate batch, chunk 500)
- REST: `GET /api/v1/runs/{id}/results` (paginated), `GET /api/v1/runs/{id}/results/export` (streaming CSV)
- Frontend: Results page — stat cards (match rate, record count, mismatch count), record selector, field-level diff table

**Acceptance criteria:**
- 100k result records can be exported as CSV without OOM error
- Field diff table shows expected vs actual side-by-side with PASS/FAIL per field
- Mismatched fields highlighted in red
- `GET /results` endpoint is paginated with default page size 50

---

## Milestone 2 — Protocol Connectors (Weeks 5–7)
**Goal:** All five protocols working end-to-end with real brokers/systems.

---

### M2-E1: File & CSV Connector

**What to build:**
- `FileConnector implements ConnectorPort`
- Streaming CSV read (OpenCSV) — one `CapturedMessage` per row
- Streaming CSV, JSON, XML, Excel write for replay/output
- Memory-safe: never load full file into heap (per scalability.instructions.md section 10)
- SAX-based Excel streaming for files > 10MB
- Resilience4j retry on file access errors

**Copilot prompt:**
> "Implement epic M2-E1. Build FileConnector implementing ConnectorPort. Use streaming CSV (OpenCSV) and SAX-based Excel (XSSF + ContentHandler) per scalability.instructions.md section 10. Add Resilience4j retry per scalability.instructions.md section 4. Emit connector metrics."

---

### M2-E2: Database Connector

**What to build:**
- `DbConnector implements ConnectorPort`
- Capture: executes a SELECT from source DB, returns rows as `CapturedMessage` (one per row, JSON payload)
- Replay: executes parameterised INSERT/UPSERT into target DB
- Uses a separate `DataSource` per environment (not the app's own DataSource)
- `EnvironmentDataSourceFactory` — creates and pools HikariCP connections per environment ID

**Acceptance criteria:**
- Supports SQL Server, Oracle, PostgreSQL (JDBC driver on classpath)
- Row batch size configurable (default 1000)
- Connection pool per environment, max 5 connections

---

### M2-E3: IBM MQ Connector

**What to build:**
- `IbmMqConnector implements ConnectorPort`
- Preserve MQMD: `CorrelId`, `MsgId`, `Format`, `Persistence`, `ReplyToQueue`
- Snapshot capture: receive N messages or wait T seconds, then stop
- Continuous capture: long poll with configurable sleep interval
- Correlation key extracted from `JMSCorrelationID` or configurable header
- Resilience4j circuit breaker + retry

**Acceptance criteria:**
- Connection factory built from `Environment.properties` JSON at runtime (not hardcoded in yml)
- MQ exceptions wrapped as `ConnectorException` with reason code in message
- Integration test with IBM MQ Docker image (`ibmcom/mq`)

---

### M2-E4: Apache Kafka Connector

**What to build:**
- `KafkaConnector implements ConnectorPort`
- Consumer group ID per run: `paralleliq-{runId}` (prevents offset collision between runs)
- Capture from beginning or from current offset (configurable)
- Preserve all record headers and partition key on replay
- `ProducerRecord` built from `TransformedMessage` with original headers restored
- Resilience4j circuit breaker + retry

---

### M2-E5: Solace PubSub+ Connector

**What to build:**
- `SolaceConnector implements ConnectorPort`
- JCSMP API (`com.solacesystems:sol-jcsmp`)
- Preserve user properties and application message ID
- Support both direct (non-persistent) and guaranteed (persistent) delivery on replay
- Dead message queue routing when `ReplayOptions.dmqEndpoint` is set

---

### M2-E6: SFTP Connector

**What to build:**
- `SftpConnector implements ConnectorPort`
- Apache Commons VFS2 with JSch provider
- Capture: list files matching glob pattern, download, parse per extension
- Replay: write files to target SFTP path with configurable naming pattern
- Optional PGP encryption on replay if `pgpKeyRef` is set in target config
- File-processed tracking: write `.done` marker file or move to archive subfolder

---

## Milestone 3 — Transform Engine (Weeks 8–10)
**Goal:** Full field-level transformation with all rule types, lookup enrichment, and env swap.

---

### M3-E1: Core Transform Engine

**What to build:**
- `TransformService` — applies a `RuleSet` to a `CapturedMessage`, returns `TransformedMessage`
- `RuleExecutorRegistry` — maps `RuleType` → `RuleExecutor` implementation
- `RuleExecutor<T>` interface: `execute(String value, T rule, LookupContext ctx) → String`
- Implementations: `DirectRuleExecutor`, `DateFormatRuleExecutor`, `EnvSwapRuleExecutor`
- `LookupContext` — holds pre-loaded lookup results for the current run (cache-first)
- Error handling strategies: `SKIP_ROW`, `HALT_RUN`, `SUBSTITUTE_DEFAULT`
- Transform metrics: `paralleliq.transform.records` counter

---

### M3-E2: Advanced Rule Types

**What to build (one executor per rule type):**
- `RegexExtractRuleExecutor` — extract capture group from field value
- `ConditionalRuleExecutor` — if/else based on field value or another field
- `ConcatRuleExecutor` — combine multiple source fields with separator
- `SplitRuleExecutor` — split a field and take index N
- `NumericFormatRuleExecutor` — decimal places, currency symbol, rounding mode
- `StaticValueRuleExecutor` — always output a fixed value (useful for env-specific constants)

**For each rule type:**
- Domain model (record with config fields)
- RuleExecutor implementation
- Unit tests covering happy path, null input, invalid config
- Frontend rule editor component in `components/ruleset/rules/`

---

### M3-E3: Correlation Engine

**What to build:**
- `CorrelationService` — matches captured messages to output records
- Three strategies:
  - `KeyBasedCorrelationStrategy` — match on exact correlation key value
  - `SequenceBasedCorrelationStrategy` — match by arrival order within run
  - `TimeWindowCorrelationStrategy` — match nearest output within configurable window
- Correlation result: `MATCHED`, `UNMATCHED_INPUT`, `UNMATCHED_OUTPUT`
- Store correlation results as part of `RunResult`
- Correlation match rate metric: `paralleliq.run.match_rate`

---

### M3-E4: Inline Override Engine

**What to build:**
- `InlineOverrideService` — applies a JSON patch over a base `RuleSet` definition
- Stored as `production_parallels.inline_overrides` (JSON Merge Patch format, RFC 7396)
- Applied at run time, after loading the base rule set
- UI: inline override editor in wizard step 3 (add/remove/change individual field rules)

**Acceptance criteria:**
- Inline override does not modify the shared `RuleSet`
- Overrides are versioned as part of the `ProductionParallel` config snapshot on each run

---

## Milestone 4 — Operations & Scheduling (Weeks 11–12)
**Goal:** Runs can be triggered automatically, monitored, and alerted on.

---

### M4-E1: Scheduler

**What to build:**
- `SchedulerService` — reads `production_parallels.schedule_cron` for all active parallels
- ShedLock integration (prevents duplicate execution across instances)
- `@SchedulerLock(name = "paralleliq_scheduled_runs", lockAtMostFor = "55s")`
- Frontend: cron editor in wizard step 7 (Review & Save), with human-readable preview ("Every day at 06:00")
- ShedLock table migration: `V2__Add_shedlock_table.sql`

---

### M4-E2: Alerting & Notifications

**What to build:**
- `AlertPort` interface: `sendAlert(AlertEvent event)`
- `AlertEvent` types: `RUN_FAILED`, `MATCH_RATE_BELOW_THRESHOLD`, `CONNECTOR_CIRCUIT_OPEN`
- Implementations: `EmailAlertAdapter`, `TeamsWebhookAlertAdapter`, `SlackWebhookAlertAdapter`
- `AlertConfiguration` per parallel: threshold (e.g. match rate < 95%), enabled channels
- Frontend: alert config section in parallel detail page

---

### M4-E3: Run History & Trend Dashboard

**What to build:**
- `GET /api/v1/parallels/{id}/runs` — paginated run history with match rates
- `GET /api/v1/projects/{id}/dashboard` — aggregated stats: runs today, avg match rate, failed count
- Frontend: Dashboard page with stat cards and sparkline trend chart (run match rate over last 14 days)
- Frontend: Run history table with filter by status and date range

---

### M4-E4: Re-run & Clone

**What to build:**
- `POST /api/v1/runs/{id}/rerun` — creates a new run using the same config snapshot as the original
- `POST /api/v1/parallels/{id}/clone` — creates a new parallel with "(copy)" suffix
- Frontend: Re-run button on results page, Clone option in parallel list action menu

---

## Milestone 5 — Developer Experience (Weeks 13–14)
**Goal:** Engineers can integrate ParallelIQ into CI/CD pipelines and manage config in Git.

---

### M5-E1: REST API — Public + Documented

**What to build:**
- All endpoints fully documented with `@Operation`, `@ApiResponse`, `@Schema` annotations
- Request/response examples on all SpringDoc `@Operation` annotations
- Authentication documented in OpenAPI spec (JWT bearer scheme)
- API versioning strategy documented (current: `/api/v1/`, future: `/api/v2/`)

---

### M5-E2: CLI Tool (Java executable JAR)

**What to build:**
- Separate Maven module: `paralleliq-cli`
- `picocli` framework for command parsing
- Commands:
  - `piq run --parallel <id> [--param key=value]` → triggers run, polls until complete, exits 0/1
  - `piq status --run <id>` → prints run status and match rate
  - `piq import --file scenario.yaml` → imports parallel config from YAML
  - `piq export --parallel <id>` → exports parallel config as YAML
- Single fat JAR (`paralleliq-cli.jar`) — one file to add to CI agent

**Copilot prompt:**
> "Implement epic M5-E2. Build a picocli CLI in a new Maven module paralleliq-cli. The 'run' command must poll run status via REST and exit with code 0 on PASSED, 1 on FAILED. Credentials from environment variable PIQ_TOKEN."

---

### M5-E3: YAML Import/Export

**What to build:**
- `ParallelYamlExporter` — converts `ProductionParallel` to YAML (SnakeYAML)
- `ParallelYamlImporter` — parses YAML, validates, creates or updates `ProductionParallel`
- YAML format matches the schema shown in `architecture.md` (name, environments, steps, params)
- REST: `GET /api/v1/parallels/{id}/export` → YAML file download
- REST: `POST /api/v1/parallels/import` → multipart YAML upload

---

### M5-E4: CI/CD Integration Guide

**What to build (documentation + example files):**
- `docs/ci-cd-integration.md` — step-by-step guide for Jenkins, GitHub Actions, Azure DevOps
- Example GitHub Actions workflow: `examples/github-actions/paralleliq.yml`
- Example Jenkins pipeline: `examples/jenkins/Jenkinsfile`
- Pattern: trigger run → poll status → fail pipeline on FAILED → publish results as test report (JUnit XML format)
- `GET /api/v1/runs/{id}/results/junit` — export run results as JUnit XML (compatible with all CI test report plugins)

---

## Milestone 6 — Data Governance & Security (Weeks 15–16)
**Goal:** Safe to use with production-adjacent data. Enterprise security controls in place.

---

### M6-E1: Data Masking

**What to build:**
- `MaskingRule` domain model — field name + strategy (REDACT, HASH_SHA256, FORMAT_PRESERVE, TOKENISE)
- `MaskingService` — applies masking rules to `CapturedMessage` payload before storing to SQL Server
- `MaskingConfiguration` per parallel (or project-wide default)
- Masking applied BEFORE `run_results` are written — never store raw PII
- Frontend: masking config section on parallel setup page

---

### M6-E2: Secrets Management Integration

**What to build:**
- `CredentialResolverPort` interface: `resolve(String credentialRef) → Credentials`
- `AzureKeyVaultCredentialAdapter` — fetches secret by name from Azure Key Vault (SDK: `com.azure:azure-security-keyvault-secrets`)
- `LocalVaultCredentialAdapter` — for dev: reads from environment variables (format: `PIQ_CRED_{REF}`)
- `credentialRef` in `environments` table is a vault key name — never a password
- Health indicator: checks vault connectivity on startup

---

### M6-E3: RBAC Hardening

**What to build:**
- Project-level roles: a user can be TESTER on Project A and ENGINEER on Project B
- `ProjectMembership` entity: `(project_id, user_id, role)`
- `@PreAuthorize` expressions use project membership, not just global role
- Flyway migration for `project_memberships` table
- Admin UI: user management page — assign users to projects with roles

---

### M6-E4: Full Audit Trail UI

**What to build:**
- `GET /api/v1/parallels/{id}/audit` — paginated audit log for a specific parallel
- `GET /api/v1/projects/{id}/audit` — project-wide audit log
- Frontend: Audit log tab on parallel detail page — timeline of changes with actor, timestamp, diff

---

## Milestone 7 — Scale & Resilience (Weeks 17–18)
**Goal:** Can run multiple instances; handles 10x current load without architecture changes.

---

### M7-E1: Redis Cache Adapter (Multi-Instance Readiness)

**What to build:**
- `RedisCacheAdapter implements CachePort` — drop-in replacement for `CaffeineCacheAdapter`
- Configuration flag: `paralleliq.cache.provider: redis | caffeine`
- Spring `@ConditionalOnProperty` to activate the right adapter
- Redis pub/sub for cache invalidation across instances
- Flyway: no schema change needed

---

### M7-E2: WebSocket Scale-Out (Redis Pub/Sub)

**What to build:**
- When running multiple instances, WebSocket events from one instance must reach clients connected to another
- Add Spring WebSocket + STOMP + Redis message broker relay
- `RunProgressPublisher` publishes to Redis topic; all instances relay to their connected clients
- Configuration flag: `paralleliq.websocket.relay: redis | in-process`

---

### M7-E3: Performance Test Suite

**What to build:**
- Gatling load test scripts in `performance/` module
- Scenario: 20 concurrent users each triggering a run with 1000 records
- Target SLOs:
  - `POST /runs` response time p99 < 200ms
  - 1000-record transform + compare completes in < 60s
  - `GET /results` (paginated 50) p99 < 300ms
- CI job that runs Gatling on merge to main and fails if SLOs breached

---

### M7-E4: Graceful Shutdown & Run Recovery

**What to build:**
- `ApplicationShutdownListener` — on shutdown signal, waits for in-progress steps to finish (up to configurable grace period, default 60s)
- `RunRecoveryService` — on startup, marks any `RUNNING` runs as `FAILED` with message "Interrupted by application restart"
- Alert sent for each recovered run
- Configurable grace period: `paralleliq.shutdown.grace-period: 60s`

---

---

## Milestone 8 — True Parallel Mode (Weeks 19–23)
**Goal:** Mode 2. Inject the same data into both environments simultaneously, capture outputs independently from each, reconcile and compare. Neither environment is the master.

```
                 ┌──▶ Env A ──▶ capture output A ──┐
Inject data ─────┤                                  ├──▶ reconcile ──▶ pass / fail
                 └──▶ Env B ──▶ capture output B ──┘
```

---

### M8-E1: Execution Mode Switch

**What to build:**
- `ExecutionMode` enum already exists (`REPLAY_VALIDATE` | `TRUE_PARALLEL`) — wire it into the execution engine
- `StepExecutionEngine` branches on `executionMode` to select the correct execution graph
- `TRUE_PARALLEL` graph: `[InjectStep → CaptureEnvAStep + CaptureEnvBStep (concurrent)] → ReconcileStep`
- `REPLAY_VALIDATE` graph unchanged — existing M1 behaviour
- Flyway: add `execution_mode` column to `production_parallels` table (default `REPLAY_VALIDATE`)
- Wizard: add execution mode selector to Step 1 (Name & Project) — when True Parallel selected, wizard adapts (step 2 becomes "Injection config" instead of "Source binding")

**Acceptance criteria:**
- Existing REPLAY_VALIDATE parallels are unaffected — no regression
- Selecting TRUE_PARALLEL in the wizard changes step labels and field options dynamically
- `ExecutionMode` is stored in `config_snapshot` on every run for full reproducibility

**Copilot prompt:**
> "Implement epic M8-E1. Add execution_mode to production_parallels via Flyway migration V3. Update StepExecutionEngine to branch on ExecutionMode. TRUE_PARALLEL graph runs CaptureEnvAStep and CaptureEnvBStep concurrently using virtual threads, then feeds both outputs into ReconcileStep. REPLAY_VALIDATE path must be identical to current behaviour — add integration tests proving no regression."

---

### M8-E2: Injection Engine

**What to build:**
- `InjectionStep` — sends the same data payload to both environments concurrently
- `InjectionConfig` — defines the data source (file, DB query, or message set) and the two target endpoints
- `InjectorPort` interface: `inject(InjectionPayload payload, List<TargetBinding> targets)` — fires to all targets simultaneously using virtual threads
- Connector implementations updated: each `ConnectorPort` gains `inject()` alongside existing `capture()` and `replay()`
- Rate synchronisation: both environments receive the injection within a configurable time window (default 100ms tolerance) — log a warning if drift exceeds threshold
- Injection audit: every injected record logged to new `injection_log` table with timestamp per environment

**Acceptance criteria:**
- Both environments receive identical payloads within the synchronisation window
- If one environment's injection fails, the run is marked FAILED — no partial reconciliation
- Injection rate is configurable (messages/second) to avoid overwhelming environments
- `injection_log` records: `run_id`, `record_key`, `env_a_injected_at`, `env_b_injected_at`, `drift_ms`

**Flyway migration V4:**
```sql
CREATE TABLE injection_log (
    id                UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    run_id            UNIQUEIDENTIFIER NOT NULL,
    record_key        NVARCHAR(500)    NOT NULL,
    payload_hash      NVARCHAR(64)     NOT NULL,   -- SHA-256 of injected payload
    env_a_injected_at DATETIME2,
    env_b_injected_at DATETIME2,
    drift_ms          INT,                          -- abs(envA - envB) in milliseconds
    created_at        DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    CONSTRAINT FK_injection_log_runs FOREIGN KEY (run_id) REFERENCES runs(id)
);
CREATE INDEX IX_injection_log_run_id ON injection_log(run_id);
```

**Copilot prompt:**
> "Implement epic M8-E2. Add InjectorPort interface and update each ConnectorPort with an inject() method. InjectionStep fires to both target environments concurrently using virtual threads, measures drift between injection timestamps, and logs to injection_log. If drift_ms exceeds paralleliq.injection.sync-tolerance-ms (default 100), log WARN. Add Flyway V4 migration."

---

### M8-E3: Dual Capture & Independent Output Extraction

**What to build:**
- `CaptureEnvAStep` and `CaptureEnvBStep` run concurrently after injection
- Each captures from its environment independently using existing `ConnectorPort.capture()`
- Results stored separately: `run_results` gains `environment_role` column (`ENV_A` | `ENV_B`)
- `OutputPullConfig` extended to support two independent pull definitions — one per environment
- Capture timing recorded alongside injection timing — allows latency analysis per environment
- `CaptureConfig` per environment: endpoint, correlation key, wait strategy (duration, count, or condition)

**Acceptance criteria:**
- ENV_A and ENV_B results stored independently and queryable separately
- If one environment produces no output within the wait window, step is marked TIMEOUT (not FAILED) — allows partial result analysis
- Correlation keys from both captures are aligned before reconciliation

**Flyway migration V5:**
```sql
-- Add environment_role to run_results
ALTER TABLE run_results ADD environment_role NVARCHAR(10) NOT NULL DEFAULT 'ENV_B';
-- ENV_A = captured from environment A, ENV_B = captured from environment B
-- For REPLAY_VALIDATE runs: ENV_A = expected (baseline), ENV_B = actual (replayed)
-- For TRUE_PARALLEL runs: both captured live, neither is the master
```

---

### M8-E4: Reconciliation Engine

**What to build:**
- `ReconciliationService` — replaces the existing `AssertionService` for TRUE_PARALLEL mode
- Takes two independently captured output sets (ENV_A and ENV_B) and compares them symmetrically — no fixed expected/actual
- `ReconciliationStrategy` interface with implementations:
  - `SymmetricFieldReconciler` — compares every field in ENV_A against the same field in ENV_B, flags any difference in either direction
  - `SchemaReconciler` — checks both outputs have the same fields and structure (useful when schema drift is a concern)
  - `StatisticalReconciler` — for numeric fields: compares distributions, means, and outliers rather than exact values (useful for high-volume financial data)
- Reconciliation result: `IDENTICAL`, `DIVERGED`, `ENV_A_ONLY`, `ENV_B_ONLY` per record
- New results view: side-by-side ENV_A vs ENV_B (no "expected/actual" language — both are peers)

**Acceptance criteria:**
- `REPLAY_VALIDATE` results view unchanged — still shows expected vs actual
- `TRUE_PARALLEL` results view shows ENV_A vs ENV_B symmetrically, with divergence highlighted
- `StatisticalReconciler` produces a summary report: field name, mean A, mean B, max deviation, records outside tolerance
- All three reconciliation strategies selectable per parallel in the wizard

**Copilot prompt:**
> "Implement epic M8-E4. Build ReconciliationService with the ReconciliationStrategy interface and three implementations. The SymmetricFieldReconciler must not use 'expected'/'actual' language — use envAValue and envBValue. The StatisticalReconciler computes mean, stddev, and max deviation per numeric field across all records in the run. Update the results UI to show the TRUE_PARALLEL view with ENV_A and ENV_B as peers."

---

### M8-E5: True Parallel Wizard & UI Adaptation

**What to build:**
- Wizard step 1 gains an execution mode selector: "Replay & Validate" | "True Parallel"
- When True Parallel is selected, the wizard restructures:
  - Step 2: **Injection config** — data source, rate, sync tolerance
  - Step 3: **Env A capture config** — endpoint, wait strategy
  - Step 4: **Transform rules** — optional, applied to injection data before sending
  - Step 5: **Env B capture config** — endpoint, wait strategy (may differ from Env A)
  - Step 6: **Reconciliation config** — strategy selection, field tolerances
  - Step 7: **Review & Save**
- Results page adapts: `TRUE_PARALLEL` runs show ENV_A / ENV_B columns, not Expected / Actual
- Dashboard: separate run counts and match rates per execution mode
- New stat card on dashboard: "Injection drift (avg ms)" — monitors synchronisation health

**Acceptance criteria:**
- Switching execution mode in step 1 re-renders the remaining wizard steps without losing previously entered data
- A tester who has never used True Parallel mode can complete the wizard without documentation

---

### M8-E6: Continuous True Parallel (Streaming Mode)

**What to build:**
- `CaptureMode.CONTINUOUS` extended to support True Parallel: inject continuously, capture from both environments in a rolling window, reconcile on a configurable cadence (e.g. every 60 seconds)
- `StreamingReconciliationJob` — runs on a schedule within the run, produces intermediate reconciliation reports
- Live dashboard updates via WebSocket: reconciliation rate updates as records flow through
- Run does not end until explicitly stopped or a time limit is reached
- Use case: run True Parallel continuously during a shadow release period (days, not minutes)

**Acceptance criteria:**
- Intermediate reconciliation reports are queryable before the run completes
- Memory usage is bounded — intermediate results flushed to SQL Server in rolling batches, not held in heap
- A continuous run can be paused and resumed (status: `PAUSED`)

---

## Summary Table

| Milestone | Weeks | Mode | Deliverable |
|-----------|-------|------|-------------|
| M1 — Foundation | 1–4 | Mode 1 | End-to-end replay & validate, file connector, results UI |
| M2 — Connectors | 5–7 | Mode 1 | All 5 protocols: MQ, Kafka, Solace, SFTP, DB |
| M3 — Transform Engine | 8–10 | Mode 1 | All rule types, correlation, inline overrides |
| M4 — Operations | 11–12 | Mode 1 | Scheduling, alerting, run history dashboard |
| M5 — Developer Experience | 13–14 | Mode 1 | CLI, YAML import/export, CI/CD JUnit export |
| M6 — Governance | 15–16 | Mode 1 | Data masking, secrets vault, RBAC, audit UI |
| M7 — Scale & Resilience | 17–18 | Mode 1 | Redis cache/websocket, performance tests, graceful shutdown |
| M8 — True Parallel | 19–23 | Mode 2 | Injection engine, dual capture, reconciliation, streaming |

**Total: 23 weeks to full product including True Parallel mode.**

---

## Design Principles Across Both Modes

These apply to every line of code written across all milestones:

1. **`ExecutionMode` is always present** — every `ProductionParallel` carries it; every service that touches a run must respect it
2. **No hardcoded expected/actual language** in domain models — use `envAOutput` and `envBOutput`; the assertion/reconciliation layer decides which is the reference
3. **Connectors are mode-agnostic** — `ConnectorPort` supports capture, replay, and inject; the execution engine decides which to call
4. **Results are always symmetric in storage** — `environment_role` column on `run_results` means the same table serves both modes; reporting adapts the presentation layer only
5. **Mode 2 must never break Mode 1** — every M8 epic includes a regression test suite proving existing REPLAY_VALIDATE runs are unaffected
