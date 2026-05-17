---
applyTo: "backend/src/**/*.java"
---

# Backend Java Instructions

## Java & Spring Boot Standards

- Java 21 — use records for DTOs, sealed interfaces for discriminated types, pattern matching where it reads clearly
- Virtual threads are enabled globally — do NOT use `CompletableFuture` or reactive types; use plain blocking code
- All Spring beans are constructor-injected — no `@Autowired` on fields
- Use `@Slf4j` (Lombok) for logging — never `System.out`
- All public methods on Application-layer services must be `@Transactional`
- Domain model classes: plain Java, no annotations of any kind (no `@Entity`, no `@Service`, no `@JsonProperty`)

## Domain Layer Rules

Files in `com.paralleliq.domain.*` must have ZERO imports from:
- `org.springframework.*`
- `jakarta.persistence.*`
- `com.fasterxml.jackson.*`

If Copilot is writing a domain class and reaches for one of these, stop and use a plain Java alternative.

## Entity vs Domain Model

There are TWO representations of every aggregate:

| Location | Type | Purpose |
|----------|------|---------|
| `domain/model/` | Plain Java class | Business logic, passed between layers |
| `infrastructure/persistence/entity/` | `@Entity` class | JPA/SQL Server persistence only |

Mappers in `infrastructure/persistence/` convert between them. Never pass JPA entities above the Infrastructure layer.

## Error Handling

- Domain errors: throw custom exceptions from `domain/model/exception/` — e.g. `ParallelNotFoundException`, `ConnectorException`
- These are caught by `GlobalExceptionHandler` (`@RestControllerAdvice`) which maps them to `ApiResponse` with the right HTTP status
- Never return `null` from a service — use `Optional<T>` or throw a domain exception

## REST Controller Pattern

```java
@RestController
@RequestMapping("/api/v1/parallels")
@Tag(name = "Production Parallels")
@RequiredArgsConstructor
public class ParallelController {

    private final ParallelService parallelService;
    private final ParallelMapper parallelMapper;

    @GetMapping("/{id}")
    @Operation(summary = "Get a production parallel by ID")
    public ResponseEntity<ApiResponse<ParallelResponse>> getById(@PathVariable UUID id) {
        var parallel = parallelService.findById(id);
        return ResponseEntity.ok(ApiResponse.success(parallelMapper.toResponse(parallel)));
    }
}
```

## Connector Implementation Pattern

```java
@Component
@RequiredArgsConstructor
public class KafkaConnector implements ConnectorPort {

    @Override
    public Protocol supports() {
        return Protocol.KAFKA;
    }

    @Override
    public List<CapturedMessage> capture(SourceBinding binding, CaptureOptions options) {
        // implementation
    }

    @Override
    public void replay(List<TransformedMessage> messages, TargetBinding binding, ReplayOptions options) {
        // implementation
    }
}
```

## Testing

- Unit tests in `src/test/java/com/paralleliq/` mirroring the main package structure
- Domain service tests: pure unit tests, no Spring context, mock all ports
- Integration tests: use `@SpringBootTest` + Testcontainers SQL Server image
- Test class names: `{ClassName}Test` for unit, `{ClassName}IT` for integration
- Use `@ExtendWith(MockitoExtension.class)` for unit tests
