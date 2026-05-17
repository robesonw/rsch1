# Add a New REST API Endpoint

## Build in this order — full vertical slice in paralleliq-api

### 1. Domain model (if needed)
File: `paralleliq-api/src/main/java/com/paralleliq/api/domain/model/{Name}.java`
- Java 8 POJO with Lombok `@Value @Builder` — no Spring, no JPA annotations
- Immutable where possible

### 2. Port interface (if new persistence or external call needed)
File: `paralleliq-api/src/main/java/com/paralleliq/api/domain/port/{Name}RepositoryPort.java`
- Plain Java interface
- Application layer calls this; Infrastructure implements it

### 3. Domain service method
File: `paralleliq-api/src/main/java/com/paralleliq/api/domain/service/{Name}Service.java`
- No Spring annotations (domain is pure Java)
- Unit test alongside: `{Name}ServiceTest.java`

### 4. Infrastructure — JPA entity and repository (if new data)
Files:
- `paralleliq-api/src/main/java/com/paralleliq/api/infrastructure/persistence/entity/{Name}Entity.java`
- `paralleliq-api/src/main/java/com/paralleliq/api/infrastructure/persistence/repository/{Name}Repository.java`
- `paralleliq-api/src/main/java/com/paralleliq/api/infrastructure/persistence/{Name}RepositoryAdapter.java` (implements port)

### 5. Application service method
File: `paralleliq-api/src/main/java/com/paralleliq/api/application/{Name}ApplicationService.java`
- `@Service @Transactional @RequiredArgsConstructor`
- Orchestrates domain services and port interfaces
- Calls `auditService.record(...)` for state-changing operations
- Handles `executionMode` branching if the feature touches ProductionParallel

### 6. DTO classes
Files: `paralleliq-api/src/main/java/com/paralleliq/api/dto/`
- `Create{Name}Request.java` — `@Data @Builder @NoArgsConstructor @AllArgsConstructor` (Java 8, not records)
- `{Name}Response.java` — same pattern
- Validation: `@NotBlank`, `@Size`, `@NotNull` on request fields

### 7. MapStruct mapper
File: `paralleliq-api/src/main/java/com/paralleliq/api/mapper/{Name}Mapper.java`
```java
@Mapper(componentModel = "spring")
public interface {Name}Mapper {
    {Name}Response toResponse({Name} domain);
    {Name} toDomain(Create{Name}Request request);
}
```

### 8. Controller method
File: `paralleliq-api/src/main/java/com/paralleliq/api/controller/{Name}Controller.java`
```java
@RestController
@RequestMapping("/api/v1/{resource}")
@Tag(name = "{Resource}")
@RequiredArgsConstructor
public class {Name}Controller {

    @GetMapping("/{id}")
    @Operation(summary = "...")
    @PreAuthorize("hasAnyRole('TESTER','ENGINEER','ADMIN')")
    public ResponseEntity<ApiResponse<{Name}Response>> getById(@PathVariable UUID id) {
        {Name} entity = applicationService.findById(id);
        return ResponseEntity.ok(ApiResponse.<{Name}Response>builder()
            .success(true)
            .data(mapper.toResponse(entity))
            .build());
    }
}
```

### 9. SQL script if schema change needed
File: `db/scripts/V{n+1}__Add_{name}_table.sql`
- Follow database.instructions.md template
- `IF NOT EXISTS` guard on all DDL

### 10. Tests
- `{Name}ServiceTest.java` — unit test with Mockito
- `{Name}ControllerTest.java` — `@WebMvcTest` with `@MockBean` service
- `{Name}RepositoryTest.java` — `@DataJpaTest` + Testcontainers (if new queries)

## Inputs needed

- HTTP method and path (e.g. `POST /api/v1/parallels/{id}/clone`)
- What it does in plain English
- Who can call it (roles: TESTER / ENGINEER / ADMIN)
- Request body fields and validation rules
- Response body fields
- Any schema changes needed
