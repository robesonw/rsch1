---
applyTo: "paralleliq-api/src/**/*.java,paralleliq-agent/src/**/*.java,paralleliq-common/src/**/*.java"
---

# Backend Java Instructions — Java 8 + Spring Boot 2.7

## Mandatory: Java 8 compatibility

This codebase runs on Java 8. Spring Boot 2.7.18 is the framework version.

**Never use:**
- `record` keyword — use `@Data @Builder @NoArgsConstructor @AllArgsConstructor` (Lombok)
- `sealed` / `permits` — use plain interfaces
- `var` — use explicit types
- Virtual threads — use `ThreadPoolTaskExecutor`
- Spring Boot 3.x APIs (`jakarta.*`) — use `javax.*`
- `@SpringBootTest` with JUnit 5 Platform only — use `@RunWith(SpringRunner.class)` for JUnit 4

## Class patterns

### DTO / Value object (replaces Java records)
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RunAssignmentDto {
    private String runId;
    private String parallelName;
    private ExecutionMode executionMode;
    // ...
}
```

### Service (Spring bean)
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class ParallelService {
    private final ParallelRepository parallelRepository;
    // ...
}
```

### Domain model (no Spring annotations)
```java
@Value   // Lombok — immutable
@Builder
public class ProductionParallel {
    private final UUID id;
    private final String name;
    private final ExecutionMode executionMode;
    // ...
}
```

## Spring Boot 2.7 specifics

- Use `javax.validation.*` not `jakarta.validation.*`
- Use `javax.persistence.*` not `jakarta.persistence.*`
- Hibernate dialect: `org.hibernate.dialect.SQLServer2012Dialect`
- WebSocket: `org.springframework.web.socket` (same package, works in 2.7)
- OpenAPI/Swagger: `springdoc-openapi-ui:1.7.0` (not springdoc 2.x)
- Actuator endpoints: same as Boot 3 but `management.endpoints.web.exposure.include`

## paralleliq-api specific

- Gradle project — do not add Maven pom.xml files here
- `spring.jpa.hibernate.ddl-auto=validate` — schema from manual SQL scripts only
- RestTemplate (not WebClient) for any HTTP calls — Java 8 compatible
- `@Transactional` at Application service layer only
- Returns `ApiResponse<T>` from all controllers
- `@PreAuthorize` on all non-public endpoints

## paralleliq-agent specific

- Maven project
- `spring.main.web-application-type=none` — no embedded web server
- Never inject `ApplicationContext` — inject specific beans
- `RestTemplate` with `HttpComponentsClientHttpRequestFactory` for timeout config
- All connector calls wrapped in try-catch, exceptions thrown as `ConnectorException`
- Log with MDC: `MDC.put("runId", runId)` at start of each run execution

## paralleliq-common specific

- No Spring Boot dependency — do not add `spring-boot-starter` to common pom.xml
- No `@Component`, `@Service`, `@Repository` annotations — plain Java classes only
- Lombok is allowed (compile-time only)
- Jackson is allowed (runtime — for DTO serialisation)
- `javax.validation` annotations are allowed on DTOs

## Error handling

```java
// Domain exceptions in common/model/exception/
public class ParallelNotFoundException extends RuntimeException {
    public ParallelNotFoundException(String id) {
        super("Production parallel not found: " + id);
    }
}

// Global handler in API
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ParallelNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handle(ParallelNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ApiResponse.<Void>builder().success(false).error(ex.getMessage()).code("NOT_FOUND").build());
    }
}
```

## Threading (Java 8 — no virtual threads)

```java
// In ExecutionConfig.java (API or Agent)
@Bean
public ThreadPoolTaskExecutor executionExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(10);
    executor.setMaxPoolSize(50);
    executor.setQueueCapacity(100);
    executor.setThreadNamePrefix("piq-exec-");
    executor.initialize();
    return executor;
}

// Usage
CompletableFuture.runAsync(() -> runExecutor.execute(assignment), executionExecutor);
```
