# ParallelIQ — GitHub Copilot Workspace Instructions

## What this product is

ParallelIQ is an enterprise **environment replay and parallel validation platform**. It exists to answer one question: *does this environment behave the same way as that one?*

It operates in two modes, delivered in phases:

---

### Mode 1 — Replay & Validate (current build scope)

Captures a run from Env A (the known-good baseline), replays it into Env B (the new release, new config, or new infrastructure), then compares the outputs of Env B against what Env A produced.

```
Env A ──capture──▶ [Transform] ──replay──▶ Env B
  │                                           │
  └──────── expected output ◀── compare ──────┘
                                    │
                              pass / fail
```

The core user concept is a **Production Parallel**: a named, saved configuration of four sections:
1. **Source binding** — what to capture from Env A (queue, topic, file, DB table)
2. **Transform rules** — how to reshape the payload (field mapping, type conversion, lookups, env swap)
3. **Target binding** — where to replay to Env B
4. **Assertion config** — how to compare actual vs expected output

---

### Mode 2 — True Parallel Run (future phase — design for it now)

Injects the same data stimulus into **both environments simultaneously**, captures outputs from each independently, then reconciles and compares them. Neither environment is the master — the product proves they produce identical results under the same input.

```
                 ┌──▶ Env A ──▶ capture output A ──┐
Inject data ─────┤                                  ├──▶ reconcile ──▶ pass / fail
                 └──▶ Env B ──▶ capture output B ──┘
```

Use cases: shadow releases, live cutover validation, continuous regression where production and a new release process the same transactions side by side.

**What this means for code written today:**
- `ExecutionMode` enum must exist from M1: `REPLAY_VALIDATE` and `TRUE_PARALLEL`
- `ProductionParallel` must carry an `executionMode` field — even if only `REPLAY_VALIDATE` is implemented now
- `ConnectorPort` must support both capture-only and inject+capture — design the interface to accommodate both
- Correlation and assertion logic must not assume Env A is always the source of truth — it will need to handle two independently captured output sets in Mode 2
- Never hard-code "source = expected, target = actual" — use `roleA` and `roleB` with the assertion direction configurable

---

---

## Architecture: Layered Modular Monolith

This is **one deployable Spring Boot application**. No microservices. No separate worker processes. The UI is a React SPA served as static assets by the same Spring Boot host.

```
┌─────────────────────────────────────────────────┐
│  API Layer        REST controllers + WebSocket   │
│  Application      Orchestration + Execution      │
│  Domain           Core models + Port interfaces  │
│  Infrastructure   Connectors + Persistence       │
└─────────────────────────────────────────────────┘
           │
      SQL Server
```

**Layer rules — strictly enforced:**
- API layer calls Application layer only
- Application layer calls Domain services and Port interfaces only
- Domain layer has zero infrastructure imports — pure Java
- Infrastructure implements Domain ports (Dependency Inversion)
- Nothing except Infrastructure touches SQL Server directly

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | Spring Boot 3.3, Java 21 |
| Concurrency | Java 21 virtual threads (`spring.threads.virtual.enabled=true`) |
| Persistence | Spring Data JPA + Flyway migrations against SQL Server |
| Messaging — IBM MQ | `spring-boot-starter-artemis` or IBM MQ Spring Boot starter |
| Messaging — Kafka | `spring-kafka` |
| Messaging — Solace | `solace-spring-boot-starter` (JCSMP) |
| File / SFTP | Apache Commons VFS2 |
| Data formats | Jackson (JSON), Apache POI (Excel), OpenCSV, JAXB (XML) |
| API docs | SpringDoc OpenAPI 3 |
| Frontend | React 18, TypeScript, TanStack Query, React Router v6 |
| Build | Maven (backend), Vite (frontend) |
| DB migrations | Flyway |
| Testing | JUnit 5, Mockito, Testcontainers (SQL Server) |

---

## Package Structure

```
com.paralleliq
├── api                          # REST controllers, DTOs, mappers
│   ├── controller
│   ├── dto
│   └── mapper
├── application                  # Use cases — orchestrate domain services
│   ├── orchestration            # RunOrchestrationService
│   ├── execution                # StepExecutionEngine (thread pool)
│   └── scenario                 # ScenarioService, ProjectService
├── domain                       # Pure business logic — NO framework imports
│   ├── model                    # ProductionParallel, Step, Run, RuleSet, etc.
│   ├── port                     # Interfaces: ConnectorPort, RunRepository, etc.
│   └── service                  # TransformService, CorrelationService, AssertionService
└── infrastructure
    ├── connector
    │   ├── mq                   # IbmMqConnector implements ConnectorPort
    │   ├── kafka                # KafkaConnector implements ConnectorPort
    │   ├── solace               # SolaceConnector implements ConnectorPort
    │   ├── sftp                 # SftpConnector implements ConnectorPort
    │   ├── file                 # FileConnector implements ConnectorPort
    │   └── db                   # DbConnector implements ConnectorPort
    ├── persistence
    │   ├── entity               # JPA @Entity classes
    │   └── repository           # Spring Data JPA repositories
    └── config                   # Spring @Configuration classes
```

---

## Naming Conventions

- Domain models: plain Java classes, no JPA annotations, no Spring annotations
- Port interfaces: suffix `Port` (e.g. `ConnectorPort`, `RunRepositoryPort`)
- Application services: suffix `Service` (e.g. `RunOrchestrationService`)
- Infrastructure implementations: prefix with technology (e.g. `IbmMqConnector`, `JpaRunRepository`)
- REST controllers: suffix `Controller` (e.g. `ParallelController`)
- DTOs: suffix `Request` or `Response` (e.g. `CreateParallelRequest`, `RunSummaryResponse`)
- Flyway migrations: `V{n}__{Description}.sql` (e.g. `V1__Create_initial_schema.sql`)

---

## Key Domain Model Relationships

```
Project
  └── ProductionParallel (has: sourceBinding, transformConfig, targetBinding, assertionConfig)
        └── Run (has: status, startedAt, completedAt, stepResults)
              └── StepResult (has: field, expected, actual, matched)

RuleSet (shared, versioned — referenced by ProductionParallel.transformConfig)
LookupDefinition (shared — referenced by RuleSet)
AssertionSet (shared, versioned — referenced by ProductionParallel.assertionConfig)
Environment (shared, admin-managed — referenced by sourceBinding and targetBinding)
```

---

## Connector Interface — Always implement this

Every protocol connector implements `ConnectorPort`:

```java
public interface ConnectorPort {
    Protocol supports();
    List<CapturedMessage> capture(SourceBinding binding, CaptureOptions options);
    void replay(List<TransformedMessage> messages, TargetBinding binding, ReplayOptions options);
}
```

Adding a new protocol = one new class implementing `ConnectorPort`. No changes to the engine.

---

## Run Execution Model

Runs execute inside a `ThreadPoolTaskExecutor` using Java 21 virtual threads. The `StepExecutionEngine` resolves the step dependency graph and dispatches steps whose dependencies are complete. Steps run concurrently when they have no pending dependencies.

Run state persists to SQL Server via the `run_steps` table (`status`: QUEUED / RUNNING / DONE / FAILED).

---

## WebSocket

Live run progress streams to the frontend over WebSocket at `/ws/runs/{runId}`. The `RunProgressPublisher` publishes `StepStatusEvent` objects whenever a step changes state. Controllers never push WebSocket events directly — they call `RunProgressPublisher`.

---

## What Copilot should always do

1. Follow the layer rules — domain model classes must never import Spring or JPA
2. Write Flyway migrations for every schema change — never use `spring.jpa.hibernate.ddl-auto=update`
3. Use `@Transactional` at the Application layer service methods, not in Domain
4. Return `ResponseEntity<ApiResponse<T>>` from all REST controllers using the shared `ApiResponse` wrapper
5. Add OpenAPI `@Operation` and `@Tag` annotations to all controllers
6. Write a unit test alongside every new domain service method
7. When adding a new connector, create it in `infrastructure/connector/{protocol}/` and register it in `ConnectorRegistry`
8. Use `MapStruct` mappers in `api/mapper/` — never map manually in controllers or services
