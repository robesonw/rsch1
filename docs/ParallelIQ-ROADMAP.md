# ParallelIQ — Product & Features Roadmap

> **Enterprise environment replay and parallel validation platform**
> Validates that one environment behaves identically to another — by capturing, replaying, and comparing data and messages across systems.

---

## Product Vision

ParallelIQ operates in two modes, delivered in phases:

| Mode | Description | Phase |
|------|-------------|-------|
| **Replay & Validate** | Capture from Env A → transform → replay to Env B → compare outputs field-by-field | Current build |
| **True Parallel** | Inject same data into both environments simultaneously → capture independently → reconcile | Future phase |

The platform is configured entirely through a browser UI. Testers set up a **Production Parallel** in a guided wizard — no YAML, no code, no infrastructure knowledge required.

---

## Architecture Summary

```
paralleliq-ui        React SPA — deployed to PCF
paralleliq-api       Spring Boot REST API — deployed to PCF
paralleliq-agent     Executable JAR — runs on Windows Server via Task Scheduler
paralleliq-common    Shared domain models and DTOs (Java library)
```

The agent handles all certificate-heavy connector operations (IBM MQ, Kafka, Solace, SFTP) from within the enterprise network. The API manages configuration, scheduling, and results. Testers interact only with the UI.

---

## Milestone Overview

| # | Milestone | Weeks | Mode | Status |
|---|-----------|-------|------|--------|
| M1 | Foundation | 1–4 | Replay & Validate | 🔵 In build |
| M2 | Protocol Connectors | 5–7 | Replay & Validate | ⚪ Planned |
| M3 | Transform Engine | 8–10 | Replay & Validate | ⚪ Planned |
| M4 | Operations & Scheduling | 11–12 | Replay & Validate | ⚪ Planned |
| M5 | Developer Experience | 13–14 | Replay & Validate | ⚪ Planned |
| M6 | Data Governance & Security | 15–16 | Replay & Validate | ⚪ Planned |
| M7 | Scale & Resilience | 17–18 | Replay & Validate | ⚪ Planned |
| M8 | True Parallel Mode | 19–23 | True Parallel | 🟡 Designed |

**Total: 23 weeks to full product including True Parallel mode.**

---

## Milestone 1 — Foundation (Weeks 1–4)

> **Goal:** End-to-end working parallel. A tester can create a production parallel, run it via the agent, and see field-level results in the UI.

### M1-E1 — Project & Environment Management

**Features:**
- Create and manage projects (grouping of related parallels)
- Admin-managed environment configuration (name, protocol, host, credential reference)
- Environments are named references — testers never see connection strings or passwords
- Environment list available as dropdowns throughout the wizard

**API endpoints:** `GET/POST /api/v1/projects`, `GET/POST /api/v1/environments`
**Roles:** Admin creates environments; testers create projects

---

### M1-E2 — Rule Set Management

**Features:**
- Create named, versioned transformation rule sets
- Supported rule types: Direct mapping, Date format conversion, Environment value swap, Derived field
- Rule set versioning — save creates a new version, old versions remain queryable
- Parallel can pin to a specific version or always use latest
- Rule set preview in the wizard (shows field mapping table before saving)

**API endpoints:** `GET/POST /api/v1/rule-sets`, `POST /api/v1/rule-sets/{id}/versions`

---

### M1-E3 — Lookup Definition Management

**Features:**
- Named lookup definitions (type: DB query, reference CSV/JSON file, or static map)
- Configurable cache TTL — lookup results cached in-process to avoid repeated DB hits
- Cache refresh without application restart
- Lookups referenced by name in rule sets — decoupled from the rule logic

**API endpoints:** `GET/POST /api/v1/lookups`

---

### M1-E4 — Assertion Set Management

**Features:**
- Named, versioned assertion sets defining how to compare outputs
- Assertion types per field: Exact match, Numeric tolerance, Regex match, Ignore
- Versioning identical to rule sets
- Assertion sets shared across parallels — define once per message type

**API endpoints:** `GET/POST /api/v1/assertion-sets`

---

### M1-E5 — Production Parallel CRUD

**Features:**
- 7-step guided wizard: Name → Source → Transform → Target → Output Pull → Assertions → Review
- Wizard adapts step labels based on execution mode (Replay & Validate vs True Parallel)
- Clone a parallel — creates independent copy with "(copy)" suffix
- Inline overrides — tweak individual rule fields without modifying the shared rule set
- YAML export/import for engineers managing config in Git

**API endpoints:** `GET/POST/PUT/DELETE /api/v1/parallels`, `POST /api/v1/parallels/{id}/clone`

---

### M1-E6 — Run Engine (Core Execution)

**Features:**
- Trigger a run via UI button, REST API, or schedule
- API creates run record (status: QUEUED) and returns immediately — non-blocking
- Agent polls for queued runs, claims one, executes, posts results back
- Run state machine: `QUEUED → PICKED_UP → RUNNING → PASSED / FAILED / CANCELLED`
- Live progress updates via WebSocket — step indicators update in real time
- Run fails gracefully if agent is unavailable — run stays QUEUED until claimed

**API endpoints:** `POST /api/v1/parallels/{id}/runs`, `GET /api/v1/runs/{id}`

---

### M1-E7 — Results & Field Diff View

**Features:**
- Field-level comparison: expected (Env A) vs actual (Env B) per record
- Pass/fail per field, mismatch reason recorded
- Paginated record selector — navigate between records in a run
- Match rate: percentage of records where all fields matched
- Streaming CSV export — 100k records without out-of-memory errors
- Stat cards: match rate, record count, mismatch count, avg correlation latency

**API endpoints:** `GET /api/v1/runs/{id}/results`, `GET /api/v1/runs/{id}/results/export`

---

## Milestone 2 — Protocol Connectors (Weeks 5–7)

> **Goal:** All five protocols working end-to-end with real enterprise brokers and systems.

### M2-E1 — File & CSV Connector

**Features:**
- Streaming CSV read (OpenCSV) — one captured message per row
- Excel support — SAX-based streaming for large files (no full-file heap load)
- JSON and XML file parsing
- Output replay to local filesystem or shared network path
- Configurable file naming pattern on replay (e.g. `{correlationKey}_{timestamp}.csv`)

---

### M2-E2 — Database Connector

**Features:**
- Capture rows from SQL Server, Oracle, or PostgreSQL via parameterised SELECT
- Each row becomes one captured message (JSON payload)
- Replay via parameterised INSERT or UPSERT into target database
- Separate HikariCP connection pool per environment (max 5 connections each)
- Configurable row batch size (default 1000)

---

### M2-E3 — IBM MQ Connector

**Features:**
- Point-to-point queues and pub/sub topics
- Preserve MQMD metadata on replay: `CorrelId`, `MsgId`, `Format`, `Persistence`, `ReplyToQueue`
- Snapshot capture: receive N messages or wait T seconds
- Continuous capture: long-poll mode
- TLS via JVM keystore args (`javax.net.ssl.*`) — certificate paths in `run.bat`
- Resilience4j: 3 retries with 3s exponential backoff + circuit breaker

---

### M2-E4 — Apache Kafka Connector

**Features:**
- Consumer group ID per run: `paralleliq-capture-{runId}` — no offset collision between runs
- Capture from beginning of partition or from current offset (configurable)
- Preserve all record headers and partition key on replay
- mTLS support — keystore and truststore paths in `application.properties`
- Configurable replay rate (messages per second)

---

### M2-E5 — Solace PubSub+ Connector

**Features:**
- JCSMP API — SMF protocol
- Preserve user properties and application message ID on replay
- Persistent (guaranteed) and direct (non-persistent) delivery modes
- Dead message queue routing when configured
- TLS via truststore — path in `application.properties`

---

### M2-E6 — SFTP Connector

**Features:**
- Apache Commons VFS2 + JSch for SSH key authentication
- Capture: list files matching glob pattern, download, parse per file extension
- Replay: write files to target SFTP path
- Configurable file naming pattern and target subdirectory
- SSH private key file path and passphrase in `application.properties`
- File-processed tracking: move to archive subfolder after capture

---

## Milestone 3 — Transform Engine (Weeks 8–10)

> **Goal:** Full field-level transformation with all rule types, lookup enrichment, env swap, and correlation.

### M3-E1 — Core Transform Engine

**Features:**
- Apply a rule set to captured messages, produce transformed messages
- Rule executor registry — maps rule type to executor implementation
- Lookup context — pre-loads lookup results at run start (cache-first)
- Error handling per field: skip row, halt run, or substitute default value
- Transform metrics: records processed counter per rule set

---

### M3-E2 — Advanced Rule Types

**Features (one executor per rule type):**

| Rule Type | What it does |
|-----------|-------------|
| `DIRECT` | Copy field as-is (with optional rename) |
| `DATE_FORMAT` | Convert date between formats (e.g. `dd/MM/yyyy` → `yyyy-MM-dd`) |
| `ENV_SWAP` | Replace environment-specific values (system IDs, URLs, account codes) |
| `LOOKUP` | Enrich field by looking up a value in a DB query or reference file |
| `REGEX_EXTRACT` | Extract a capture group from a field using a regex pattern |
| `CONDITIONAL` | if/else mapping based on field value or another field's value |
| `CONCAT` | Combine multiple source fields with a separator |
| `SPLIT` | Split a field on a delimiter and take index N |
| `NUMERIC_FORMAT` | Set decimal places, rounding mode, or currency symbol |
| `STATIC` | Always output a fixed value regardless of input |
| `DERIVED` | Arithmetic expression across multiple numeric fields |

---

### M3-E3 — Correlation Engine

**Features:**
- Match captured source messages to output records by correlation key
- Three strategies: Key-based (exact match), Sequence-based (arrival order), Time-window (nearest within configurable window)
- Correlation result per record: `MATCHED`, `UNMATCHED_INPUT`, `UNMATCHED_OUTPUT`
- Correlation match rate metric emitted per run

---

### M3-E4 — Inline Override Engine

**Features:**
- Apply a JSON patch over a base rule set without modifying the shared version
- Stored per parallel in `production_parallels.inline_overrides`
- UI: inline override editor in wizard step 3 (add/remove/change individual field rules)
- Overrides versioned as part of the config snapshot on each run

---

## Milestone 4 — Operations & Scheduling (Weeks 11–12)

> **Goal:** Runs trigger automatically, teams can monitor trends, and failures generate alerts.

### M4-E1 — Scheduler

**Features:**
- Cron expression per parallel — stored in database, evaluated by the API
- ShedLock prevents duplicate scheduling when multiple API instances run
- Human-readable schedule preview in the UI ("Every day at 06:00")
- Next scheduled run time displayed on parallel list

---

### M4-E2 — Alerting & Notifications

**Features:**
- Alert triggers: run failed, match rate below threshold, connector circuit open
- Configurable threshold per parallel (default: alert when match rate < 95%)
- Delivery channels: Email, Microsoft Teams webhook, Slack webhook
- Alert configuration section on the parallel detail page

---

### M4-E3 — Run History & Trend Dashboard

**Features:**
- Dashboard stat cards: active parallels, average match rate today, failed this week, total runs today
- Run history table: paginated, filterable by status and date range
- Match rate sparkline trend per parallel (last 14 days)
- Agent registry panel (admin): lists connected agents, last-seen timestamp, supported protocols

---

### M4-E4 — Re-run & Clone

**Features:**
- Re-run: creates a new run using the exact config snapshot from the original run (fully reproducible)
- Clone: creates an independent copy of a parallel with all config preserved
- Re-run button on results page
- Clone option in parallel list action menu

---

## Milestone 5 — Developer Experience (Weeks 13–14)

> **Goal:** Engineers can integrate ParallelIQ into CI/CD pipelines and manage configuration in Git.

### M5-E1 — OpenAPI Documentation

**Features:**
- All endpoints documented with `@Operation`, response examples, and schema annotations
- Swagger UI at `/swagger-ui.html`
- JWT authentication documented in OpenAPI spec
- API versioning strategy documented (`/api/v1/`)

---

### M5-E2 — CLI Tool

**Features:**
- Executable JAR with picocli command parsing
- Commands:
  - `piq run --parallel <id> [--param key=value]` — triggers run, polls to completion, exits 0/1
  - `piq status --run <id>` — prints run status and match rate
  - `piq import --file parallel.yaml` — imports parallel config from YAML
  - `piq export --parallel <id>` — exports parallel config as YAML
- Auth via environment variable `PIQ_TOKEN`
- Exit code 0 = PASSED, 1 = FAILED — gates CI/CD pipelines

---

### M5-E3 — YAML Import / Export

**Features:**
- Export any parallel as a YAML file (downloadable from UI or via CLI)
- Import YAML to create or update a parallel
- YAML is the Git-friendly exchange format — the UI is the primary authoring surface
- Import validates schema and reports errors before applying

---

### M5-E4 — CI/CD Integration

**Features:**
- JUnit XML export: `GET /api/v1/runs/{id}/results/junit` — compatible with Jenkins, GitHub Actions, Azure DevOps test report plugins
- Example pipeline files: GitHub Actions workflow, Jenkins pipeline
- CI/CD integration guide in `docs/ci-cd-integration.md`
- Pattern: trigger run → poll → fail pipeline on FAILED → publish JUnit report

---

## Milestone 6 — Data Governance & Security (Weeks 15–16)

> **Goal:** Safe to use with production-adjacent data. Full enterprise security controls.

### M6-E1 — Data Masking

**Features:**
- Field-level masking applied before captured data is stored
- Masking strategies per field: Redact (replace with `***`), SHA-256 hash, Format-preserving substitution, Tokenisation
- Masking configuration per parallel (or project-wide default)
- Masking applied at capture time — raw PII never written to SQL Server

---

### M6-E2 — Secrets Management

**Features:**
- `credential_ref` in environments table is a vault key reference — never a plaintext password
- Azure Key Vault adapter: fetches secrets at runtime by reference name
- Local adapter (dev/test): reads from environment variables (`PIQ_CRED_{REF}`)
- Health indicator: verifies vault connectivity at startup

---

### M6-E3 — RBAC Hardening

**Features:**
- Project-level roles: a user can be TESTER on Project A and ENGINEER on Project B
- Roles: `TESTER`, `ENGINEER`, `ADMIN`
- Project membership managed by admins in the UI
- All endpoints enforced with `@PreAuthorize` at the controller level

---

### M6-E4 — Full Audit Trail UI

**Features:**
- Every create, update, delete, clone, and run recorded to `audit_log` table
- Audit log tab on parallel detail page — timeline of changes with actor and timestamp
- Project-wide audit log for admins
- Paginated and filterable by action type and actor

---

## Milestone 7 — Scale & Resilience (Weeks 17–18)

> **Goal:** Multiple API instances, Redis-backed caching and WebSocket relay, performance test suite, graceful shutdown.

### M7-E1 — Redis Cache Adapter

**Features:**
- `RedisCacheAdapter` as a drop-in replacement for the default Caffeine in-process cache
- Activated via config flag: `paralleliq.cache.provider=redis`
- Redis pub/sub for cache invalidation across API instances
- No code changes required — only `CachePort` interface is used throughout

---

### M7-E2 — WebSocket Scale-Out

**Features:**
- STOMP + Redis message broker relay for live run progress across multiple API instances
- Activated via config flag: `paralleliq.websocket.relay=redis`
- A client connected to Instance A receives progress events from a run executing on Instance B
- In-process relay remains the default for single-instance deployments

---

### M7-E3 — Performance Test Suite

**Features:**
- Gatling load test scripts in a dedicated `performance/` module
- Scenario: 20 concurrent users each triggering a run with 1000 records
- Target SLOs:
  - `POST /runs` p99 < 200ms
  - 1000-record transform + compare < 60s
  - `GET /results` paginated p99 < 300ms
- CI job that fails if SLOs are breached on merge to main

---

### M7-E4 — Graceful Shutdown & Run Recovery

**Features:**
- On shutdown signal: wait for in-progress steps to finish (grace period, default 60s)
- On startup: any run stuck in `RUNNING` status (from an interrupted previous instance) is marked `FAILED` with a clear message
- Alert sent for each recovered run
- Configurable grace period: `paralleliq.shutdown.grace-period=60s`

---

## Milestone 8 — True Parallel Mode (Weeks 19–23)

> **Goal:** Inject the same data into both environments simultaneously, capture outputs independently, and reconcile without either environment being the master.

```
                 ┌──▶ Env A ──▶ capture output A ──┐
Inject data ─────┤                                  ├──▶ reconcile ──▶ pass / fail
                 └──▶ Env B ──▶ capture output B ──┘
```

### M8-E1 — Execution Mode Switch

**Features:**
- `ExecutionMode` field on every `ProductionParallel`: `REPLAY_VALIDATE` or `TRUE_PARALLEL`
- Wizard step 1 gains a mode selector — remaining steps adapt labels and fields
- Execution engine branches on mode — existing REPLAY_VALIDATE behaviour is unchanged
- Regression tests prove no impact on existing parallels

---

### M8-E2 — Injection Engine

**Features:**
- Same payload injected to both environments concurrently (virtual threads / CompletableFuture)
- Synchronisation window: both environments receive injection within configurable tolerance (default 100ms)
- Drift measurement: `env_a_injected_at` vs `env_b_injected_at` recorded per record in `injection_log`
- Warning logged if drift exceeds tolerance threshold
- Run fails if one environment's injection fails — no partial reconciliation

---

### M8-E3 — Dual Capture

**Features:**
- `CaptureEnvAStep` and `CaptureEnvBStep` run concurrently after injection
- Results stored independently in `run_results` with `environment_role` = `ENV_A` or `ENV_B`
- Output pull config extended: separate pull definition per environment
- TIMEOUT status if one environment produces no output within the wait window (partial result analysis allowed)

---

### M8-E4 — Reconciliation Engine

**Features:**
- Symmetric comparison — no fixed expected/actual
- `SymmetricFieldReconciler` — compares every field in ENV_A against ENV_B, flags differences in either direction
- `SchemaReconciler` — validates both environments produce the same field structure
- `StatisticalReconciler` — for numeric fields: mean, standard deviation, and max deviation across all records (useful for financial data volumes)
- Reconciliation result per record: `IDENTICAL`, `DIVERGED`, `ENV_A_ONLY`, `ENV_B_ONLY`

---

### M8-E5 — True Parallel UI

**Features:**
- Wizard adapts completely for True Parallel mode — different step labels and field sets
- Results page uses "Env A output" / "Env B output" column labels (never "expected/actual")
- Dashboard shows run counts and match rates by execution mode separately
- New stat card: "Injection drift (avg ms)" — monitors synchronisation health

---

### M8-E6 — Continuous Parallel Mode (Streaming)

**Features:**
- Inject continuously, capture from both environments in a rolling window
- Intermediate reconciliation reports on a configurable cadence (e.g. every 60 seconds)
- Run does not end until explicitly stopped or a time limit is reached
- Memory-bounded — intermediate results flushed to SQL Server in batches (never held in heap)
- Run can be paused and resumed (status: `PAUSED`)
- Use case: shadow release validation running over days, not minutes

---

## Cross-Cutting Design Principles

These apply across every milestone and every line of code:

| Principle | Rule |
|-----------|------|
| **ExecutionMode always present** | Every `ProductionParallel` carries it; all execution logic branches on it |
| **No hardcoded expected/actual** | Use `envAOutput` / `envBOutput` in domain models; the presentation layer decides labels |
| **Connectors are mode-agnostic** | `ConnectorPort` supports capture, replay, and inject — the engine decides which to call |
| **Results schema is symmetric** | `environment_role` column serves both modes from a single table |
| **Mode 2 never breaks Mode 1** | Every M8 epic includes a regression test suite against existing REPLAY_VALIDATE parallels |
| **No plaintext secrets** | Passwords and keys always from environment variables or vault references |
| **Stateless API** | All run state in SQL Server — a second PCF instance can be added without architecture changes |
| **Agent exits cleanly** | Task Scheduler mode: start → process all queued runs → exit 0 or exit 1 |
| **UI is the product** | Every feature ships with UI before CLI or API documentation |

---

## Feature Summary by User Role

### Tester
- Create and run production parallels via the 7-step wizard
- View live run progress and field-level diff results
- Re-run with changed params or clone for a variant
- Export results as CSV
- View run history and trend for their parallels

### Engineer / Test Lead
- Create and version shared rule sets and assertion sets
- Define lookup definitions (DB queries, reference files)
- Import/export parallels as YAML for Git management
- Use the CLI to trigger runs from scripts
- Integrate runs into CI/CD pipelines via REST API and JUnit XML export

### Administrator
- Configure named environments (connection config, credential vault references)
- Manage users and project memberships
- View agent registry — connected Windows Server agents and their capabilities
- Configure data masking rules for PII fields
- Access the full project-wide audit trail

---

*Last updated: May 2026 — reflects three-module architecture (paralleliq-common, paralleliq-api, paralleliq-agent, paralleliq-ui), Java 8, Spring Boot 2.7, PCF deployment, Windows Server Task Scheduler agent.*
