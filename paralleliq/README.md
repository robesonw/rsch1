# ParallelIQ

Enterprise environment replay and parallel validation platform.

## Module Overview

```
paralleliq/
├── paralleliq-common/    Maven  — shared domain models, DTOs, port interfaces (Java 8)
├── paralleliq-api/       Gradle — REST API + UI, deployed to PCF              (Java 8, Spring Boot 2.7)
└── paralleliq-agent/     Maven  — execution agent, runs on Windows Server     (Java 8, Spring Boot 2.7)
```

## How the three modules work together

```
┌─────────── PCF ──────────────────────────────────┐
│  paralleliq-api  ←→  paralleliq-ui (React)        │
│  REST API, config, results, auth, scheduling       │
│  No connector code — never touches MQ/Kafka/Solace │
└───────────────────┬──────────────────────────────-┘
                    │  HTTPS (REST polls + result posts)
                    │  Outbound only from agent
                    ▼
┌─────────── Windows Server ───────────────────────┐
│  paralleliq-agent.jar                             │
│  Scheduled via Windows Task Scheduler             │
│  Connects to: IBM MQ, Kafka, Solace, SFTP, DB    │
│  Certificates managed here — local JKS/PKCS12    │
└───────────────────────────────────────────────────┘
```

## Build order (always build common first)

```bash
# 1. Build and install common to local Maven repo
cd paralleliq-common
mvn clean install

# 2. Build the API
cd ../paralleliq-api
./gradlew clean build

# 3. Build the agent
cd ../paralleliq-agent
mvn clean package
```

## Database setup

No migration tool. Run SQL scripts manually in order:

```
db/scripts/
  V1__Create_initial_schema.sql      — run first, always
  V2__Add_agent_registration.sql     — run after V1
  V3__Add_execution_mode.sql         — run after V2
```

See `db/scripts/README.md` for full instructions.

## GitHub Copilot setup

All Copilot context lives in `.github/`:
- `.github/copilot-instructions.md` — master workspace context (auto-loaded)
- `.github/instructions/` — file-scoped instructions per module and concern
- `.github/prompts/` — reusable agent task prompts

### Running a prompt
In Copilot Chat:
> "Follow #file:.github/prompts/new-connector.prompt.md and add a RabbitMQ connector"
