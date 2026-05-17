---
applyTo: "backend/src/**/*.java"
---

# Security Instructions

## Authentication & Authorisation

- Spring Security with JWT bearer tokens
- RBAC: three roles — `ROLE_ADMIN`, `ROLE_ENGINEER`, `ROLE_TESTER`
- Role permissions:

| Action | TESTER | ENGINEER | ADMIN |
|--------|--------|----------|-------|
| Run a parallel | ✓ | ✓ | ✓ |
| Create / edit parallel | ✓ | ✓ | ✓ |
| Create / edit rule sets | | ✓ | ✓ |
| Create / edit assertion sets | | ✓ | ✓ |
| Create / edit environments | | | ✓ |
| Manage users | | | ✓ |
| View results | ✓ | ✓ | ✓ |

- Annotate controller methods with `@PreAuthorize("hasRole('ADMIN')")` etc.
- Never check roles inside domain or application services — always at the API boundary

## Credentials & Secrets

- Environment connection strings are NEVER stored in plaintext in SQL Server
- `Environment.credentialRef` is a key reference into Azure Key Vault (or HashiCorp Vault)
- Credentials are resolved at runtime by `CredentialResolverPort` in `infrastructure/config/`
- Copilot must never generate code that puts passwords, API keys, or connection strings into:
  - Database columns
  - Log statements
  - API responses
  - `application.yml` (except local dev placeholder)

## Sensitive Data in Logs

- Use `@ToString(exclude = {"password","credential","secret"})` on any Lombok class with sensitive fields
- Never log captured message payloads at INFO or above — use DEBUG with a size-limit truncation helper

## SQL Injection Prevention

- Always use Spring Data JPA or parameterised JPQL/native queries — never string concatenation in queries
- For dynamic SQL (e.g. output pull queries defined by users), validate against an allowlist of SQL keywords and run through `SqlValidator` before execution

## Audit Trail

Every create, update, delete, and run action must be written to `audit_log` via the `AuditService`:

```java
auditService.record(AuditEvent.builder()
    .entityType("ProductionParallel")
    .entityId(parallel.getId())
    .action(AuditAction.CREATED)
    .actor(SecurityContextHolder.getContext().getAuthentication().getName())
    .detail(objectMapper.writeValueAsString(parallel))
    .build());
```

`AuditService` is called from the Application layer — never from controllers or domain services.
