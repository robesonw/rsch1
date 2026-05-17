---
applyTo: "paralleliq-api/src/**/*.java"
---

# Security Instructions — paralleliq-api

## Authentication — two separate schemes

**Browser users (UI):** JWT bearer token in `Authorization` header.
Login via AD/LDAP (`spring-boot-starter-data-ldap`) or local user table.

**Agent (Windows Server):** `X-Agent-Key` shared secret header.
Configured in `application.properties` as `${AGENT_KEY}` — never hardcoded.
Agent endpoints (`/api/v1/agent/**`) use a separate security filter chain.

```java
// Two filter chains in SecurityConfig.java
@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true)
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Bean
    @Order(1)
    public SecurityFilterChain agentFilterChain(HttpSecurity http) throws Exception {
        http.antMatcher("/api/v1/agent/**")
            .addFilterBefore(new AgentKeyFilter(agentKey), BasicAuthenticationFilter.class)
            .csrf().disable()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);
        return http.build();
    }

    @Bean
    @Order(2)
    public SecurityFilterChain uiFilterChain(HttpSecurity http) throws Exception {
        http.authorizeRequests()
            .antMatchers("/api-docs/**", "/swagger-ui/**", "/actuator/health").permitAll()
            .antMatchers("/api/v1/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated()
            .and().addFilterBefore(new JwtAuthFilter(jwtService), BasicAuthenticationFilter.class)
            .csrf().disable()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);
        return http.build();
    }
}
```

## RBAC — three roles

| Action | TESTER | ENGINEER | ADMIN |
|--------|--------|----------|-------|
| View parallels and runs | ✓ | ✓ | ✓ |
| Create / edit parallels | ✓ | ✓ | ✓ |
| Create / edit rule sets | | ✓ | ✓ |
| Create / edit assertion sets | | ✓ | ✓ |
| Configure environments | | | ✓ |
| View agent registrations | | ✓ | ✓ |
| Manage users / roles | | | ✓ |

```java
// Controller method annotations
@PreAuthorize("hasRole('ADMIN')")
@PostMapping("/environments")
public ResponseEntity<?> createEnvironment(...) { ... }

@PreAuthorize("hasAnyRole('TESTER','ENGINEER','ADMIN')")
@PostMapping("/parallels/{id}/runs")
public ResponseEntity<?> triggerRun(...) { ... }
```

Role checks always at the API boundary — never inside domain or application services.

## Credentials and secrets — strict rules

Environment connection strings are NEVER stored in plaintext in SQL Server.
`environments.credential_ref` is a vault key reference only.

**Copilot must never generate code that puts passwords, keys, or connection strings into:**
- Database columns (use vault refs)
- Log statements at any level
- API responses
- `application.properties` with literal values (use `${ENV_VAR}`)
- Git-committed files of any kind

```java
// Wrong
String password = "mypassword123";

// Right
@Value("${paralleliq.db.password}")
private String password; // resolved from environment variable at startup
```

## SQL injection prevention

Always use parameterised queries — never string concatenation:

```java
// Wrong
String sql = "SELECT * FROM runs WHERE status = '" + status + "'";

// Right — Spring Data JPA
@Query("SELECT r FROM RunEntity r WHERE r.status = :status")
List<RunEntity> findByStatus(@Param("status") RunStatus status, Pageable pageable);
```

For dynamic output-pull SQL queries defined by users: validate against an allowlist
of SQL keywords before execution via `SqlSafetyValidator` in the application service.

## Audit trail — mandatory for all state changes

Every create, update, delete, and run trigger must be written to `audit_log`:

```java
// Application service — after any state-changing operation
auditService.record(
    AuditEvent.builder()
        .entityType("ProductionParallel")
        .entityId(parallel.getId())
        .action(AuditAction.CREATED)
        .actor(SecurityContextHolder.getContext().getAuthentication().getName())
        .detail(objectMapper.writeValueAsString(parallel))
        .build()
);
```

`AuditService` is called from the Application layer only — never from controllers.

## Certificate handling

Certificates for connecting to IBM MQ, Kafka, Solace, SFTP **must not be in the API**.
They belong in the `paralleliq-agent` on the Windows Server.
The API passes connection properties (host, port, queue name) to the agent via the run assignment.
The agent resolves certificates locally from the paths in its `application.properties`.

PCF handles HTTPS termination for the API — no keystore configuration needed in `application.properties` for PCF deployments.
