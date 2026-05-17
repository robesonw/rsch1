# ParallelIQ

Enterprise production parallel test orchestration platform.

## What it does

Captures data or messages from one environment (Env A), applies configurable transformation rules, replays them to another environment (Env B), and compares outputs field-by-field — all configured through a browser UI.

## Quick start

### Prerequisites

- Java 21+
- Node.js 20+
- SQL Server 2019+ (or Docker: `docker run -e ACCEPT_EULA=Y -e SA_PASSWORD=YourStrong@Passw0rd -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest`)
- Maven 3.9+

### Backend

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

API runs on http://localhost:8080
Swagger UI: http://localhost:8080/swagger-ui

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI runs on http://localhost:5173 (proxies `/api` to port 8080)

---

## GitHub Copilot setup

This repo is configured for GitHub Copilot agent mode. All context files live in `.github/`:

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Workspace-level instructions — auto-loaded by Copilot |
| `.github/instructions/backend.instructions.md` | Applied to all `*.java` files |
| `.github/instructions/frontend.instructions.md` | Applied to all `*.ts` / `*.tsx` files |
| `.github/instructions/database.instructions.md` | Applied to all SQL migration files |
| `.github/instructions/connectors.instructions.md` | Applied to connector package files |
| `.github/instructions/testing.instructions.md` | Applied to all test files |
| `.github/instructions/security.instructions.md` | Applied to all backend files |

### Reusable agent prompts

Use these in Copilot Chat (`@workspace /new-connector`, etc.):

| Prompt file | Use when |
|-------------|---------|
| `new-connector.prompt.md` | Adding support for a new messaging protocol |
| `new-api-endpoint.prompt.md` | Adding a new REST endpoint (full vertical slice) |
| `new-rule-type.prompt.md` | Adding a new field transformation rule type |
| `new-db-migration.prompt.md` | Any schema change |
| `debug-mismatch.prompt.md` | Investigating a field comparison failure |

### How to use a prompt in Copilot

1. Open Copilot Chat in VS Code
2. Type: `Use @workspace and follow #file:.github/prompts/new-connector.prompt.md`
3. Provide the inputs listed at the bottom of the prompt file
4. Copilot generates the full vertical slice

---

## Project structure

```
paralleliq/
├── .github/
│   ├── copilot-instructions.md     ← Master Copilot context
│   ├── instructions/               ← File-scoped instructions
│   └── prompts/                    ← Reusable agent task prompts
├── docs/
│   ├── architecture.md             ← Layer rules and decisions
│   ├── data-model.md               ← Entity relationship guide
│   └── connector-interface.md      ← How to add a new connector
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/paralleliq/
│       ├── api/                    ← Controllers, DTOs, Mappers
│       ├── application/            ← Use-case services
│       ├── domain/                 ← Pure business logic + port interfaces
│       └── infrastructure/         ← Connectors + JPA persistence
└── frontend/
    └── src/
        ├── components/             ← wizard/, results/, parallels/, shared/
        ├── pages/
        ├── hooks/
        ├── services/               ← API client functions
        └── types/                  ← TypeScript interfaces mirroring backend DTOs
```

## Adding a new protocol connector

See `.github/prompts/new-connector.prompt.md` — or the short version:

1. Add enum value to `domain/model/Protocol.java`
2. Create `infrastructure/connector/{protocol}/{Name}Connector.java` implementing `ConnectorPort`
3. Spring auto-registers it via `ConnectorRegistry` — no manual wiring needed
4. Add unit tests and a sample config block in `application.yml`

## Database migrations

All schema changes via Flyway. Never touch `spring.jpa.hibernate.ddl-auto`.

```bash
# Validate current schema
./mvnw flyway:migrate

# Check pending migrations
./mvnw flyway:info
```

New migration files: `backend/src/main/resources/db/migration/V{n+1}__{Description}.sql`

## Running tests

```bash
# All tests (requires Docker for Testcontainers)
./mvnw verify

# Unit tests only (no Docker needed)
./mvnw test -Dgroups="unit"

# Integration tests only
./mvnw test -Dgroups="integration"
```
