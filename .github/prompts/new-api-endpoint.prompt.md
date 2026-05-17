# Add a New REST API Endpoint

## Task

Add a new REST endpoint to ParallelIQ following the full vertical slice pattern.

## What to build — in order

1. **Domain model change** (if needed)
   - Add/update class in `domain/model/`
   - Pure Java, no annotations

2. **Port interface** (if new persistence or external call needed)
   - Add method to existing port in `domain/port/` or create new port interface

3. **Domain service method**
   - Add to existing service in `domain/service/` or create new service
   - Unit test alongside: `{ServiceName}Test.java`

4. **Infrastructure implementation** (if new port added)
   - JPA repository method in `infrastructure/persistence/repository/`
   - Or new connector call

5. **Application service method** at `application/{feature}/{FeatureService}.java`
   - Orchestrates domain services and ports
   - Annotated `@Transactional`
   - Calls `auditService.record(...)` if state-changing

6. **DTO classes** at `api/dto/`
   - `{Action}{Resource}Request.java` for request body
   - `{Resource}Response.java` for response body
   - Use Java records

7. **MapStruct mapper** at `api/mapper/{Resource}Mapper.java`
   - Interface annotated `@Mapper(componentModel = "spring")`
   - Methods: `toResponse(DomainModel)`, `toDomain(RequestDto)`

8. **Controller method** at `api/controller/{Resource}Controller.java`
   - `@Operation(summary = "...")` and `@Tag(name = "...")`
   - Returns `ResponseEntity<ApiResponse<{Resource}Response>>`
   - Calls application service, uses mapper
   - `@PreAuthorize` with correct role

9. **Controller test** at `src/test/java/.../api/controller/{Resource}ControllerTest.java`
   - Happy path
   - 404 when not found
   - 403 when wrong role

## Inputs needed

- HTTP method and path (e.g. `POST /api/v1/parallels/{id}/clone`)
- What it does in plain English
- Who can call it (roles)
- Request body fields (if any)
- Response body fields
