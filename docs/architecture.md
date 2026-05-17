# ParallelIQ — Architecture

## Summary

ParallelIQ is a **layered modular monolith**. One Spring Boot application, one SQL Server database. The React UI is served as static assets by the same host. There are no separate worker processes, no message broker for internal coordination, no microservices.

## Why this architecture

- Testers open a URL — nothing to install, nothing to configure locally
- One deployment unit = one thing to monitor, update, and debug
- Java 21 virtual threads provide lightweight concurrency inside the process — no need to distribute work across services
- SQL Server is already in scope and handles persistence, job state, and audit — no additional infrastructure needed
- When scaling is needed: run two instances pointing at the same SQL Server. The run status table coordinates naturally.

## Layer Rules

```
┌─────────────────────────────────────────────────────────────────┐
│ API Layer                                                        │
│   REST controllers, DTOs, MapStruct mappers, WebSocket handlers │
│   → calls Application layer only                                │
├─────────────────────────────────────────────────────────────────┤
│ Application Layer                                               │
│   Use-case services: RunOrchestrationService, ScenarioService   │
│   → calls Domain services and Port interfaces                   │
│   → owns @Transactional boundaries                              │
│   → calls AuditService for all state-changing operations        │
├─────────────────────────────────────────────────────────────────┤
│ Domain Layer                                                     │
│   Pure Java: models, port interfaces, business logic services   │
│   ZERO Spring imports, ZERO JPA imports                         │
│   → calls Port interfaces only (never implementations)          │
├─────────────────────────────────────────────────────────────────┤
│ Infrastructure Layer                                            │
│   Implements Domain ports:                                      │
│     Connectors: IBM MQ, Kafka, Solace, SFTP, File, DB          │
│     Persistence: JPA entities + Spring Data repositories        │
│   → calls Domain models (but Domain never calls Infrastructure) │
└─────────────────────────────────────────────────────────────────┘
                              │
                        SQL Server
```

**The single most important rule:** nothing in `domain/` imports anything from `org.springframework.*`, `jakarta.persistence.*`, or `infrastructure.*`. The build should fail if this is violated. (Add ArchUnit tests to enforce it.)

## Execution Model

Runs execute via `StepExecutionEngine` in the Application layer:
1. `RunOrchestrationService` receives a trigger (from API, schedule, or CLI)
2. It loads the `ProductionParallel` config and creates a `Run` record (status = QUEUED)
3. `StepExecutionEngine` uses a `ThreadPoolTaskExecutor` (virtual threads) to execute steps
4. Steps are dispatched in dependency order — steps with no pending deps run concurrently
5. Each step calls `ConnectorRegistry.forProtocol()` to get the right connector
6. Step results (field diffs) are written to `run_results` as they complete
7. WebSocket events are published to the frontend via `RunProgressPublisher` on each state change

## Connector Model

Every protocol connector implements `ConnectorPort` (in `domain/port/`):
- `supports()` → returns `Protocol` enum value
- `capture()` → reads from Env A, returns `List<CapturedMessage>`
- `replay()` → writes to Env B

`ConnectorRegistry` (`infrastructure/config/`) auto-discovers all `ConnectorPort` Spring beans. Adding a protocol = one new class.

## WebSocket

Endpoint: `ws://{host}/ws/runs/{runId}`

The frontend connects on run start. `RunProgressPublisher` (Application layer) sends `StepStatusEvent` JSON objects as steps move through QUEUED → RUNNING → DONE/FAILED. The UI updates step indicators in real time without polling.

## Config Reuse Hierarchy

```
Platform layer (admin, once):
  Environment — named connection configs, credentials in vault

Shared config layer (engineer, per domain):
  RuleSet      — versioned field transformation rules
  LookupDef   — named DB queries or reference files for enrichment
  AssertionSet — versioned field comparison rules with tolerances

Parallel layer (tester, per test need):
  ProductionParallel — references above by name, adds endpoint + inline overrides
```

## API Design

Base path: `/api/v1/`
Auth: JWT bearer token in `Authorization` header
All responses: `ApiResponse<T>` envelope `{ success, data, error, code }`
Docs: Swagger UI at `/swagger-ui` (SpringDoc)

Key resources:
- `/api/v1/projects` — project CRUD
- `/api/v1/parallels` — production parallel CRUD + run trigger
- `/api/v1/runs/{id}` — run status + results
- `/api/v1/rule-sets` — rule set CRUD + versioning
- `/api/v1/environments` — environment admin (ADMIN role)
- `/api/v1/assertion-sets` — assertion set CRUD + versioning
