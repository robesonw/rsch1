---
applyTo: "paralleliq-api/src/**/*.java,paralleliq-agent/src/**/*.java"
---

# Observability Instructions

Every significant operation must be measurable, traceable, and loggable.

## Stack

| Concern | Library | Where |
|---------|---------|-------|
| Metrics | Micrometer + Prometheus | paralleliq-api |
| Logging | SLF4J + Logback (JSON in prod) | api + agent |
| Health | Spring Actuator | paralleliq-api |

Add to `paralleliq-api/build.gradle`:
```groovy
implementation 'io.micrometer:micrometer-registry-prometheus'
```

---

## Structured logging — always use MDC

Every log line must carry context identifiers so logs are queryable by run or user.

```java
// Application service — set context at start of operation
MDC.put("runId",     runId.toString());
MDC.put("parallelId", parallelId.toString());
MDC.put("userId",    getCurrentUser());
try {
    log.info("Run triggered for parallel '{}'", parallelName);
    // all subsequent log lines in this call carry the MDC context
} finally {
    MDC.clear();
}
```

**Agent — always set runId in MDC at start of each run:**
```java
// In RunExecutor.execute()
MDC.put("runId", assignment.getRunId());
try {
    log.info("Executing run for parallel '{}'", assignment.getParallelName());
    // ... execution
} finally {
    MDC.clear();
}
```

**Never log:**
- Message payloads at INFO or above (PII risk, volume)
- Passwords, tokens, keys at any level
- Stack traces manually — always `log.error("message", exception)`

---

## Custom metrics — add these to every new service

Inject `MeterRegistry` and emit:

```java
@Service
@RequiredArgsConstructor
public class RunOrchestrationService {

    private final MeterRegistry meterRegistry;

    public RunDto triggerRun(UUID parallelId, TriggerRunRequest request) {
        long start = System.currentTimeMillis();
        RunDto run = doTriggerRun(parallelId, request);
        long durationMs = System.currentTimeMillis() - start;

        meterRegistry.timer("paralleliq.run.duration",
            "protocol", run.getSourceProtocol(),
            "mode",     run.getExecutionMode()
        ).record(durationMs, TimeUnit.MILLISECONDS);

        meterRegistry.counter("paralleliq.run.completed",
            "status",   run.getStatus().name(),
            "protocol", run.getSourceProtocol(),
            "mode",     run.getExecutionMode()
        ).increment();

        return run;
    }
}
```

**Required metrics — Copilot must add for every new feature:**

| Metric | Type | Tags | Emitted by |
|--------|------|------|-----------|
| `paralleliq.run.duration` | Timer | `protocol`, `mode`, `status` | API on run completion |
| `paralleliq.run.completed` | Counter | `status`, `protocol`, `mode` | API on run completion |
| `paralleliq.run.match_rate` | Gauge | `parallel_id` | API when results posted |
| `paralleliq.connector.capture.duration` | Timer | `protocol` | Agent on each capture |
| `paralleliq.connector.replay.duration` | Timer | `protocol` | Agent on each replay |
| `paralleliq.connector.errors` | Counter | `protocol`, `error_type` | Agent on connector error |
| `paralleliq.cache.hits` | Counter | `cache_name` | API/Agent on cache hit |
| `paralleliq.cache.misses` | Counter | `cache_name` | API/Agent on cache miss |
| `paralleliq.agent.runs_processed` | Counter | `agent_id`, `status` | Agent at run completion |

---

## Health indicators — paralleliq-api

```java
@Component
public class SqlServerHealthIndicator implements HealthIndicator {
    private final DataSource dataSource;
    public SqlServerHealthIndicator(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    @Override
    public Health health() {
        try (Connection c = dataSource.getConnection()) {
            c.createStatement().executeQuery("SELECT 1");
            return Health.up().withDetail("database", "SQL Server").build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}
```

Create an `AgentConnectivityHealthIndicator` that checks whether any agent has registered
in the last 15 minutes — indicates the Windows Server agent is running as expected.

---

## Actuator configuration — paralleliq-api application.properties

```properties
management.endpoints.web.exposure.include=health,info,metrics,prometheus,loggers
management.endpoint.health.show-details=when-authorized
management.metrics.tags.application=paralleliq-api
management.metrics.tags.environment=${ENVIRONMENT:local}
```

`/actuator/prometheus` — Prometheus scrape endpoint
`/actuator/health`    — load balancer / PCF health probe
`/actuator/loggers`   — change log level at runtime without restart

---

## Logback — JSON output for production

`paralleliq-api/src/main/resources/logback-spring.xml`:
```xml
<springProfile name="prod">
    <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="net.logstash.logback.encoder.LogstashEncoder">
            <includeMdcKeyName>runId</includeMdcKeyName>
            <includeMdcKeyName>parallelId</includeMdcKeyName>
            <includeMdcKeyName>userId</includeMdcKeyName>
        </encoder>
    </appender>
    <root level="INFO"><appender-ref ref="JSON"/></root>
</springProfile>
```

Add to `paralleliq-api/build.gradle`:
```groovy
implementation 'net.logstash.logback:logstash-logback-encoder:7.4'
```

**Agent logging** goes to a rolling file (`C:\paralleliq\logs\agent.log`).
Task Scheduler does not reliably capture stdout — file logging is mandatory for the agent.
