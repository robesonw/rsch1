---
applyTo: "backend/src/**/*.java"
---

# Scalability Instructions — Always Apply These

## Core Principle

Write every class as if it will run under 10x current load. This means:
- No unbounded queries or result sets
- No synchronous blocking where async is available
- No in-process state that prevents running multiple instances
- No N+1 queries

---

## 1. Pagination — Mandatory on All List Endpoints

Every endpoint returning a collection MUST be paginated. No exceptions.

```java
// Controller
@GetMapping
public ResponseEntity<ApiResponse<Page<ParallelSummary>>> list(
    @RequestParam String projectId,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size,
    @RequestParam(defaultValue = "createdAt,desc") String sort
) {
    var pageable = PageableFactory.of(page, size, sort, ALLOWED_SORT_FIELDS);
    return ResponseEntity.ok(ApiResponse.success(parallelService.list(projectId, pageable)));
}
```

```java
// PageableFactory — always whitelist sortable fields to prevent injection
public class PageableFactory {
    public static Pageable of(int page, int size, String sort, Set<String> allowed) {
        // parse sort, validate field is in allowed set, cap size at 100
        int cappedSize = Math.min(size, 100);
        // ...
        return PageRequest.of(page, cappedSize, direction, validField);
    }
}
```

Frontend must use cursor/page controls — never load all records.

---

## 2. Caching — Caffeine (in-process) + Redis-ready interface

Use a `CachePort` interface so caching is swappable without touching domain code:

```java
// domain/port/CachePort.java
public interface CachePort {
    <T> Optional<T> get(String key, Class<T> type);
    <T> void put(String key, T value, Duration ttl);
    void evict(String key);
    void evictByPrefix(String prefix);
}
```

Default implementation uses Caffeine (zero extra infrastructure):

```java
// infrastructure/cache/CaffeineCacheAdapter.java
@Component
public class CaffeineCacheAdapter implements CachePort {
    // Caffeine with configurable max-size and TTL from application.yml
}
```

When Redis is needed (multi-instance), swap to `RedisCacheAdapter implements CachePort` — no domain or application changes.

**What to cache:**
- `LookupDefinition` results — key: `lookup:{name}:{lookupKey}`, TTL from `lookup_definitions.cache_ttl_s`
- `Environment` configs — key: `env:{id}`, TTL 5 minutes (admin rarely changes)
- `RuleSet` latest version — key: `ruleset:latest:{name}`, TTL 1 minute
- `AssertionSet` latest version — same pattern

**What NOT to cache:**
- Run results — always read fresh
- User session data — stateless JWT handles this

---

## 3. Database — Efficient Queries

### Always use projections for list queries — never fetch full entities

```java
// Wrong — fetches all columns including large JSON blobs
List<ProductionParallelEntity> findByProjectId(UUID projectId);

// Right — fetch only what the list view needs
@Query("SELECT p.id, p.name, p.status, e1.name as sourceEnvName, e2.name as targetEnvName " +
       "FROM ProductionParallelEntity p " +
       "JOIN EnvironmentEntity e1 ON p.sourceEnvId = e1.id " +
       "JOIN EnvironmentEntity e2 ON p.targetEnvId = e2.id " +
       "WHERE p.projectId = :projectId")
Page<ParallelSummaryProjection> findSummariesByProjectId(UUID projectId, Pageable pageable);
```

### Bulk insert run results — never row-by-row

```java
// Wrong — one INSERT per field comparison
runResults.forEach(result -> runResultRepository.save(result));

// Right — batch in chunks of 500
@Modifying
@Query(value = "INSERT INTO run_results (...) VALUES ...", nativeQuery = true)
void bulkInsert(List<RunResultEntity> results);

// Or use JdbcTemplate batch for large volumes
jdbcTemplate.batchUpdate(sql, results, 500, (ps, result) -> { ... });
```

### Query result set streaming for large runs

```java
// For runs with > 10k records, stream results instead of loading into memory
@QueryHints(@QueryHint(name = HINT_FETCH_SIZE, value = "500"))
@Query("SELECT r FROM RunResultEntity r WHERE r.runId = :runId")
Stream<RunResultEntity> streamByRunId(UUID runId);
```

### Index strategy — always add indexes for:
- Foreign key columns (SQL Server does not auto-index FKs)
- Status columns used in WHERE clauses (`runs.status`)
- Timestamp columns used for sorting (`runs.started_at DESC`)
- Composite: `(run_id, matched)` on `run_results` for mismatch filtering

---

## 4. Resilience — Resilience4j on All External Calls

Every connector `capture()` and `replay()` call wraps the external system. Apply Resilience4j:

```java
// Add to pom.xml: io.github.resilience4j:resilience4j-spring-boot3

@Component
@RequiredArgsConstructor
public class KafkaConnector implements ConnectorPort {

    @CircuitBreaker(name = "kafka", fallbackMethod = "captureFallback")
    @Retry(name = "kafka")
    @TimeLimiter(name = "kafka")
    public List<CapturedMessage> capture(SourceBinding binding, CaptureOptions options) {
        // ...
    }

    private List<CapturedMessage> captureFallback(SourceBinding b, CaptureOptions o, Exception e) {
        throw new ConnectorException("Kafka unavailable after retries: " + e.getMessage(), e, Protocol.KAFKA);
    }
}
```

Configure per-connector in `application.yml`:

```yaml
resilience4j:
  circuitbreaker:
    instances:
      kafka:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
      ibm-mq:
        slidingWindowSize: 5
        failureRateThreshold: 60
        waitDurationInOpenState: 60s
  retry:
    instances:
      kafka:
        maxAttempts: 3
        waitDuration: 2s
        exponentialBackoffMultiplier: 2
  timelimiter:
    instances:
      kafka:
        timeoutDuration: 30s
```

---

## 5. Async Run Execution — Never Block the HTTP Thread

Triggering a run must be non-blocking. The API responds immediately with the run ID; execution happens on the thread pool.

```java
// Application layer
@Transactional
public Run triggerRun(UUID parallelId, TriggerRunCommand command) {
    var run = createRunRecord(parallelId, command);  // persisted, status=QUEUED
    executionEngine.submitAsync(run.getId());        // fire and forget
    return run;
}
```

```java
// StepExecutionEngine
public void submitAsync(UUID runId) {
    CompletableFuture.runAsync(() -> executeRun(runId), virtualThreadExecutor)
        .exceptionally(ex -> {
            markRunFailed(runId, ex.getMessage());
            return null;
        });
}
```

`virtualThreadExecutor` is a `ThreadPoolTaskExecutor` with virtual threads — configured once in `ExecutionConfig.java`.

---

## 6. Stateless Design — Multi-Instance Ready from Day One

The application MUST be stateless so a second instance can be added without architecture changes:

- **No in-memory run state** — all run status in SQL Server `runs` table
- **No local file storage** — use configured shared path (NFS, Azure Files, or S3-compatible)
- **No in-process WebSocket session state** — use Spring's `SimpMessagingTemplate` backed by SQL Server (or swap to Redis pub/sub when scaling)
- **JWT is stateless** — no server-side session store
- **Scheduled jobs** — use `@SchedulerLock` (ShedLock library) to prevent duplicate execution across instances:

```java
// Add: net.javacrumbs.shedlock:shedlock-spring + shedlock-provider-jdbc-template
@Scheduled(cron = "${paralleliq.scheduler.cron:0 * * * * *}")
@SchedulerLock(name = "paralleliq_scheduled_runs", lockAtMostFor = "55s")
public void triggerScheduledRuns() {
    // only one instance will execute this at a time
}
```

---

## 7. Large Result Export — Streaming HTTP Response

Never load thousands of results into memory for export:

```java
@GetMapping(value = "/{runId}/results/export", produces = "text/csv")
public void exportResults(
    @PathVariable UUID runId,
    HttpServletResponse response
) throws IOException {
    response.setHeader("Content-Disposition", "attachment; filename=results-" + runId + ".csv");
    response.setContentType("text/csv");

    try (var writer = new PrintWriter(response.getWriter());
         var stream = runResultRepository.streamByRunId(runId)) {
        writer.println("record_key,field_name,expected,actual,matched");
        stream.forEach(r -> writer.println(
            csvEscape(r.getRecordKey()) + "," + csvEscape(r.getFieldName()) + ",..."));
    }
}
```

---

## 8. Connection Pool Sizing (HikariCP)

Default HikariCP settings are fine for development but must be tuned for production. Add to `application.yml`:

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20          # start here; tune based on DB server capacity
      minimum-idle: 5
      connection-timeout: 30000      # 30s before failing
      idle-timeout: 600000           # 10 min idle before releasing
      max-lifetime: 1800000          # 30 min max connection lifetime
      leak-detection-threshold: 60000 # warn if connection held > 60s
```

---

## 9. Input Validation — Fail Fast at the API Boundary

```java
// On all request DTOs
public record CreateParallelRequest(
    @NotBlank @Size(max = 200) String name,
    @NotNull UUID projectId,
    @NotNull @Valid SourceBindingRequest sourceBinding,
    @NotNull @Valid TargetBindingRequest targetBinding
) {}

// Controller must have @Valid
public ResponseEntity<?> create(@Valid @RequestBody CreateParallelRequest request) { ... }
```

---

## 10. Memory-Safe File Processing

Never load an entire file into memory. Process row by row:

```java
// CSV — use streaming reader
try (var reader = new CSVReader(new FileReader(path))) {
    reader.forEach(row -> processRow(row));  // processes one row at a time
}

// Excel — use SAX-based streaming for large files (XSSF + SAX)
// Never use: new XSSFWorkbook(file)  — loads entire file into heap
// Instead: use XSSFSheetXMLHandler with streaming API
```

Set max file size in `application.yml`:
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 100MB
      max-request-size: 100MB
```
