# ParallelIQ — GitHub Copilot Workspace Instructions

## Product vision

ParallelIQ is an enterprise **environment replay and parallel validation platform**. It answers: *does this environment behave the same way as that one?*

**Mode 1 — Replay & Validate (current build scope)**
Capture from Env A → transform → replay to Env B → compare outputs field-by-field.

**Mode 2 — True Parallel (future phase — design for it now)**
Inject the same data into both environments simultaneously → capture outputs independently → reconcile. Neither environment is the master.

Every `ProductionParallel` carries an `executionMode` field from day one.
Never hardcode expected/actual — use `envAOutput` / `envBOutput`.

---

## Three-module structure

```
paralleliq/
├── paralleliq-common/   Maven  · Java 8  — shared models, DTOs, port interfaces
├── paralleliq-api/      Gradle · Java 8  — REST API + React UI · deployed to PCF
└── paralleliq-agent/    Maven  · Java 8  — execution agent · Windows Server Task Scheduler
```

**Build order — always:**
```bash
cd paralleliq-common && mvn clean install   # installs to local Maven repo
cd ../paralleliq-api  && ./gradlew clean build
cd ../paralleliq-agent && mvn clean package
```

---

## Module responsibilities — strictly enforced

### paralleliq-common
- Domain models (`Protocol`, `ExecutionMode`, `RunStatus`)
- Shared DTOs (`AgentDtos` — `RunAssignment`, `RunResultPayload`, `ProgressUpdate`)
- Port interfaces (no implementations)
- **No Spring Boot dependency** — plain Java 8 + Lombok + Jackson

### paralleliq-api (Gradle · PCF deployment)
- REST controllers for UI and agent communication
- Run queue management — agents poll `/api/v1/agent/runs/next`
- Results storage — agents POST to `/api/v1/agent/runs/{id}/results`
- Scenario and parallel configuration CRUD
- Authentication (JWT or AD/LDAP)
- React UI served as static assets from `src/main/resources/static/`
- Spring Boot 2.7.x, `spring.jpa.hibernate.ddl-auto=validate`
- **NO connector code** — no MQ/Kafka/Solace/SFTP dependencies whatsoever

### paralleliq-agent (Maven · Windows Server JAR)
- Polls API for queued runs — executes them — posts results back
- All connector code: IBM MQ, Kafka, Solace, SFTP, File, Database
- Transform engine, correlation engine, assertion engine
- Runs via Windows Task Scheduler (`spring.main.web-application-type=none`)
- Exits after processing all queued runs (exit 0 = success, exit 1 = error)
- Certificate and keystore management on the local server

---

## Java 8 — mandatory coding style

Spring Boot 2.7.x is required (Spring Boot 3.x requires Java 17+).

| Avoid (Java 14+) | Use instead (Java 8) |
|------------------|---------------------|
| `record Foo(String x)` | `@Data @Builder @NoArgsConstructor @AllArgsConstructor class Foo` |
| Sealed interfaces | Regular interface + implementations |
| Virtual threads | `ThreadPoolTaskExecutor` with explicit pool size |
| `var` | Explicit types |
| Pattern matching `instanceof` | Traditional instanceof + cast |
| Text blocks | Regular String concatenation or StringBuilder |

All domain classes use Lombok: `@Data`, `@Builder`, `@Value`, `@RequiredArgsConstructor`.
All DTOs use: `@Data @Builder @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true)`.

---

## Database — manual SQL scripts (no Flyway)

Schema is managed by numbered scripts in `db/scripts/`. Never add Flyway as a dependency.

- Scripts run manually by a DBA using SSMS or sqlcmd
- Each script is idempotent (`IF NOT EXISTS` guards on all DDL)
- Each script ends with an `INSERT INTO schema_versions` row
- New schema change = new script `V{n+1}__Description.sql`
- `spring.jpa.hibernate.ddl-auto=validate` in both API and agent

---

## paralleliq-api layer rules

```
API layer        → controllers, DTOs, mappers — calls Application only
Application layer → use-case services — calls Domain and Port interfaces
Domain layer     → pure Java 8, NO Spring, NO JPA — zero framework imports
Infrastructure   → JPA entities, repositories, Spring config
```

**Domain layer rule:** nothing in `com.paralleliq.api.domain.*` imports `org.springframework.*` or `jakarta.persistence.*`. ArchUnit test enforces this.

---

## Agent communication contract

```
Agent polls:   GET  /api/v1/agent/runs/next          (header: X-Agent-Id)
               ← RunAssignment or null (nothing queued)

Agent reports: POST /api/v1/agent/runs/{id}/progress
               ← ProgressUpdate

Agent finishes: POST /api/v1/agent/runs/{id}/results
               ← RunResultPayload
```

All agent calls use `X-Agent-Key` header — not JWT. Configured in `application.properties`.

---

## Connector interface (agent only)

Every connector in the agent implements `ConnectorPort`:

```java
public interface ConnectorPort {
    Protocol supports();
    List<CapturedMessage> capture(String endpoint, Map<String,String> options, Map<String,String> connProps);
    void replay(List<TransformedMessage> messages, String endpoint, Map<String,String> options, Map<String,String> connProps);
}
```

`ConnectorRegistry` auto-discovers all `ConnectorPort` beans. Adding a protocol = one new class.

---

## Certificate handling (agent only)

Certificates are managed on the Windows Server — never in PCF or the API.

- IBM MQ TLS: JVM args `-Djavax.net.ssl.keyStore` / `-Djavax.net.ssl.trustStore`
- Kafka mTLS: `application.properties` — `paralleliq.connector.kafka.ssl.*`
- Solace TLS: `application.properties` — `paralleliq.connector.solace.ssl.*`
- SFTP SSH: private key file path in `application.properties`
- SQL Server TLS: `trustServerCertificate=true` in JDBC URL (dev) or import CA into JVM truststore (prod)
- Passwords: always from environment variables (`${ENV_VAR}`) — never hardcoded

---

## What Copilot must always do

1. Use Java 8 syntax — Lombok replaces records and sealed interfaces
2. Spring Boot 2.7.x — not 3.x
3. No Flyway — new schema changes go in `db/scripts/V{n+1}__Description.sql` with `IF NOT EXISTS` guards
4. No connector code in `paralleliq-api` — if a feature needs to touch MQ/Kafka/Solace/SFTP, it belongs in `paralleliq-agent`
5. `paralleliq-common` has no Spring Boot dependency — pure Java + Lombok + Jackson
6. Agent exits after processing — never runs a web server (`spring.main.web-application-type=none`)
7. All DTOs in common annotated with `@JsonIgnoreProperties(ignoreUnknown = true)` — forward/backward compatibility
8. `executionMode` field present on every new feature touching `ProductionParallel`
9. Unit tests alongside every new service method
10. Passwords and keys always from `${ENV_VAR}` — never hardcoded strings
