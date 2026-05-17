---
applyTo: "paralleliq-api/src/**/*.java,paralleliq-agent/src/**/*.java"
---

# Scalability Instructions — Always Apply These

Write every class as if it will run under 10× current load.

---

## 1. Pagination — mandatory on ALL list endpoints in paralleliq-api

```java
// Controller — always accept page/size/sort
@GetMapping
public ResponseEntity<ApiResponse<Page<ParallelSummaryDto>>> list(
    @RequestParam String projectId,
    @RequestParam(defaultValue = "0")          int page,
    @RequestParam(defaultValue = "20")         int size,
    @RequestParam(defaultValue = "createdAt,desc") String sort
) {
    // PageableFactory caps size at 100 and whitelists sort fields
    Pageable pageable = PageableFactory.of(page, size, sort,
        new HashSet<>(Arrays.asList("name", "createdAt", "lastRunAt")));
    return ResponseEntity.ok(ApiResponse.<Page<ParallelSummaryDto>>builder()
        .success(true)
        .data(parallelService.list(projectId, pageable))
        .build());
}
```

```java
// PageableFactory — whitelist sort fields to prevent SQL injection via sort param
public final class PageableFactory {
    public static final int MAX_PAGE_SIZE = 100;

    public static Pageable of(int page, int size, String sort, Set<String> allowedFields) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        // parse and validate sort field — default to createdAt DESC if invalid
        return PageRequest.of(safePage, safeSize, resolvedSort(sort, allowedFields));
    }
}
```

---

## 2. No N+1 queries — use projections for list views

```java
// Wrong — fetches full entity including large JSON blob columns
List<ProductionParallelEntity> findByProjectId(UUID projectId, Pageable pageable);

// Right — fetch only what the list needs
@Query("SELECT p.id AS id, p.name AS name, p.executionMode AS executionMode, " +
       "e1.name AS sourceEnvironmentName, e2.name AS targetEnvironmentName " +
       "FROM ProductionParallelEntity p " +
       "JOIN EnvironmentEntity e1 ON p.sourceEnvId = e1.id " +
       "JOIN EnvironmentEntity e2 ON p.targetEnvId = e2.id " +
       "WHERE p.projectId = :projectId")
Page<ParallelSummaryProjection> findSummaries(
    @Param("projectId") UUID projectId, Pageable pageable);
```

---

## 3. Bulk insert run results — never row-by-row

The agent can produce thousands of field diff records per run.
Use JdbcTemplate batch — never loop `save()`:

```java
// In paralleliq-agent — bulk insert field results in chunks of 500
private static final int BATCH_SIZE = 500;

public void bulkInsertResults(List<FieldResultDto> results) {
    List<List<FieldResultDto>> batches = partition(results, BATCH_SIZE);
    for (List<FieldResultDto> batch : batches) {
        jdbcTemplate.batchUpdate(
            "INSERT INTO run_results (run_id, record_key, field_name, " +
            "expected_value, actual_value, matched, environment_role) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            batch,
            BATCH_SIZE,
            (ps, r) -> {
                ps.setString(1, r.getRunId());
                ps.setString(2, r.getRecordKey());
                ps.setString(3, r.getFieldName());
                ps.setString(4, r.getExpectedValue());
                ps.setString(5, r.getActualValue());
                ps.setBoolean(6, r.isMatched());
                ps.setString(7, r.getEnvironmentRole());
            }
        );
    }
}
```

---

## 4. Caching — CachePort interface (Caffeine default, Redis-ready)

The `CachePort` in `paralleliq-common/domain/port/` abstracts caching.
Default: Caffeine (zero extra infrastructure).
Scale-out: swap to `RedisCacheAdapter` with one config flag — no domain code changes.

```java
// What to cache in the API
cachePort.put(CachePort.environmentKey(envId), env, Duration.ofMinutes(5));
cachePort.put(CachePort.ruleSetLatestKey(name), ruleSet, Duration.ofMinutes(1));

// What to cache in the agent (lookup enrichment)
cachePort.put(CachePort.lookupKey(defName, key), value, Duration.ofSeconds(ttl));
```

Emit metrics on every cache operation:
```java
meterRegistry.counter("paralleliq.cache.hits",   "cache", cacheName).increment();
meterRegistry.counter("paralleliq.cache.misses",  "cache", cacheName).increment();
```

---

## 5. Async run triggering — never block the HTTP thread

```java
// Application service in paralleliq-api
@Transactional
public RunDto triggerRun(UUID parallelId, TriggerRunRequest request) {
    RunEntity run = createRunRecord(parallelId, request); // persisted, status=QUEUED
    // Agent picks it up via polling — API does nothing else
    // The run is now in the queue — return immediately
    return runMapper.toDto(run);
}
```

The agent polls every N seconds and picks up QUEUED runs. The API never executes connector code directly.

---

## 6. Memory-safe file processing (paralleliq-agent)

Never load an entire file into memory:

```java
// CSV — streaming row by row
try (CSVReader reader = new CSVReader(new FileReader(path))) {
    String[] row;
    while ((row = reader.readNext()) != null) {
        processRow(row);   // one row at a time — no list accumulation
    }
}

// Excel — SAX streaming for large files (never new XSSFWorkbook(file))
OPCPackage pkg = OPCPackage.open(file);
XSSFReader xssfReader = new XSSFReader(pkg);
// Use XSSFSheetXMLHandler with ContentHandler
```

---

## 7. Stateless API — multi-instance ready from day one

- No in-memory run state in `paralleliq-api` — all run status in SQL Server `runs` table
- No local file storage in the API — files live on SFTP or paths the agent can reach
- JWT is stateless — no server-side session store
- ShedLock on scheduled jobs — prevents duplicate execution when two API instances run

```java
@Scheduled(cron = "${paralleliq.scheduler.cron}")
@SchedulerLock(name = "paralleliq_scheduler", lockAtMostFor = "55s")
public void triggerScheduledRuns() {
    // Only one API instance will execute this — ShedLock coordinates via DB
}
```

---

## 8. HikariCP — production pool sizing

`application.properties` in `paralleliq-api`:
```properties
spring.datasource.hikari.maximum-pool-size=${DB_POOL_MAX:20}
spring.datasource.hikari.minimum-idle=${DB_POOL_MIN:5}
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.leak-detection-threshold=60000
```

---

## 9. Large result export — streaming HTTP response

```java
@GetMapping(value = "/{runId}/results/export", produces = "text/csv")
public void exportResults(@PathVariable String runId,
                          HttpServletResponse response) throws IOException {
    response.setHeader("Content-Disposition",
        "attachment; filename=results-" + runId + ".csv");
    response.setContentType("text/csv");

    try (PrintWriter writer = new PrintWriter(response.getWriter());
         Stream<RunResultEntity> stream = runResultRepository.streamByRunId(UUID.fromString(runId))) {
        writer.println("record_key,field_name,expected,actual,matched");
        stream.forEach(r -> writer.println(
            csvEscape(r.getRecordKey()) + "," + csvEscape(r.getFieldName()) + ",..."));
    }
}
```

`@QueryHints(@QueryHint(name = HINT_FETCH_SIZE, value = "500"))` on the streaming repository method.

---

## 10. Input validation — always at the API boundary

```java
public class CreateParallelRequest {
    @NotBlank
    @Size(max = 200)
    private String name;

    @NotNull
    private UUID projectId;

    @NotNull
    @Valid
    private SourceBindingRequest sourceBinding;
}

// Controller must have @Valid
public ResponseEntity<?> create(@Valid @RequestBody CreateParallelRequest request) { ... }
```
