---
applyTo: "backend/src/**/*.java"
---

# Observability Instructions

ParallelIQ must be production-observable from day one. Every significant operation must be measurable, traceable, and alertable without code changes.

## Stack

| Concern | Library |
|---------|---------|
| Metrics | Micrometer + Prometheus endpoint |
| Tracing | Micrometer Tracing + Brave (OpenTelemetry-compatible) |
| Logging | Logback structured JSON (via `logstash-logback-encoder`) |
| Health | Spring Actuator |

Add to `pom.xml`:
```xml
<dependency><groupId>io.micrometer</groupId><artifactId>micrometer-registry-prometheus</artifactId></dependency>
<dependency><groupId>io.micrometer</groupId><artifactId>micrometer-tracing-bridge-brave</artifactId></dependency>
<dependency><groupId>net.logstash.logback</groupId><artifactId>logstash-logback-encoder</artifactId><version>7.4</version></dependency>
```

---

## Structured Logging — Always Use MDC

Every log line must carry context. Set MDC at the start of every meaningful operation:

```java
// Application service — set run context before any log statements
MDC.put("runId", runId.toString());
MDC.put("parallelId", parallelId.toString());
MDC.put("userId", currentUser());
try {
    log.info("Run started");
    // ... all logs inside carry runId, parallelId, userId automatically
} finally {
    MDC.clear();
}
```

Logback outputs JSON with MDC fields included — every log line in Kibana/Splunk is queryable by `runId`.

`logback-spring.xml` (production profile):
```xml
<appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
  <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
</appender>
```

**Never log:**
- Message payloads at INFO or above (PII risk, volume)
- Passwords, tokens, or credential values at any level
- Stack traces manually — always use `log.error("message", exception)`

---

## Custom Metrics — Business-Level Counters and Timers

Add these metrics via `MeterRegistry` injection. Copilot must add metrics to every new application service:

```java
@Service
@RequiredArgsConstructor
public class RunOrchestrationService {

    private final MeterRegistry meterRegistry;

    public Run triggerRun(UUID parallelId, TriggerRunCommand cmd) {
        // Execution timing
        return Timer.builder("paralleliq.run.duration")
            .tag("parallel_id", parallelId.toString())
            .register(meterRegistry)
            .record(() -> doTriggerRun(parallelId, cmd));
    }

    private void recordRunOutcome(Run run) {
        Counter.builder("paralleliq.run.completed")
            .tag("status", run.getStatus().name())
            .tag("protocol", run.getSourceProtocol().name())
            .register(meterRegistry)
            .increment();

        // Match rate gauge per parallel
        Gauge.builder("paralleliq.run.match_rate",
            run, r -> r.getMatchRate() != null ? r.getMatchRate() : 0.0)
            .tag("parallel_id", run.getParallelId().toString())
            .register(meterRegistry);
    }
}
```

**Required metrics — Copilot must add these for every new feature:**

| Metric name | Type | Tags | When |
|-------------|------|------|------|
| `paralleliq.run.duration` | Timer | `protocol`, `status` | Every run completion |
| `paralleliq.run.completed` | Counter | `status` | Every run completion |
| `paralleliq.run.match_rate` | Gauge | `parallel_id` | After assertion step |
| `paralleliq.connector.capture.duration` | Timer | `protocol` | Every capture call |
| `paralleliq.connector.replay.duration` | Timer | `protocol` | Every replay call |
| `paralleliq.connector.errors` | Counter | `protocol`, `error_type` | Every connector error |
| `paralleliq.transform.records` | Counter | `rule_set` | Per transformed record |
| `paralleliq.cache.hits` | Counter | `cache_name` | Cache hit |
| `paralleliq.cache.misses` | Counter | `cache_name` | Cache miss |

---

## Health Checks — Custom Indicators per Connector

```java
@Component
public class SqlServerHealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        try {
            // run a lightweight query
            return Health.up().withDetail("database", "SQL Server").build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}
```

Create a `HealthIndicator` for each registered environment connection (IBM MQ, Kafka, Solace). These appear at `/actuator/health` and can drive load balancer health checks.

---

## Distributed Tracing

Micrometer Tracing auto-instruments Spring MVC, JPA, and Spring Kafka. For manual spans on important operations:

```java
@Autowired
private Tracer tracer;

public List<CapturedMessage> capture(SourceBinding binding, CaptureOptions options) {
    var span = tracer.nextSpan().name("connector.capture")
        .tag("protocol", binding.protocol().name())
        .tag("endpoint", binding.endpoint())
        .start();
    try (var scope = tracer.withSpan(span)) {
        return doCapture(binding, options);
    } catch (Exception e) {
        span.error(e);
        throw e;
    } finally {
        span.end();
    }
}
```

Trace IDs appear in every log line (set by Micrometer automatically). Log lines from the same request/run share a `traceId` — use this to correlate across log entries.

---

## Actuator Endpoints

Expose in `application.yml` (production):
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus,loggers
  endpoint:
    health:
      show-details: when-authorized
    prometheus:
      enabled: true
  metrics:
    tags:
      application: paralleliq
      environment: ${ENVIRONMENT:local}
```

`/actuator/prometheus` — Prometheus scrape endpoint. Point Grafana at this.
`/actuator/health` — load balancer probe endpoint.
`/actuator/loggers` — change log level at runtime without restart.
