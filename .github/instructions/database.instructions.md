---
applyTo: "backend/src/main/resources/db/migration/**/*.sql"
---

# Database / Flyway Migration Instructions

## Rules

- Every schema change requires a new Flyway migration file — never modify an existing one
- Naming: `V{n}__{Short_description}.sql` where n is the next integer (check existing files first)
- All tables use `UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()` as primary key (named `id`)
- All tables have `created_at DATETIME2 DEFAULT SYSUTCDATETIME()` and `updated_at DATETIME2 DEFAULT SYSUTCDATETIME()`
- All foreign keys are named `FK_{child_table}_{parent_table}`
- All indexes are named `IX_{table}_{columns}`
- Use SQL Server syntax — not ANSI generic SQL (e.g. `NVARCHAR`, `DATETIME2`, `BIT`)

## Core Schema (reference — already in V1)

```sql
-- Projects
CREATE TABLE projects (
    id            UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    name          NVARCHAR(200) NOT NULL,
    description   NVARCHAR(1000),
    created_by    NVARCHAR(200) NOT NULL,
    created_at    DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Environments (admin-managed connection configs)
CREATE TABLE environments (
    id            UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    name          NVARCHAR(200) NOT NULL,          -- "Env A — Production mirror"
    protocol      NVARCHAR(50) NOT NULL,            -- IBM_MQ, KAFKA, SOLACE, SFTP, FILE, DB
    host          NVARCHAR(500),
    port          INT,
    credential_ref NVARCHAR(500),                  -- vault key reference, never plaintext
    properties    NVARCHAR(MAX),                   -- JSON blob for protocol-specific config
    created_at    DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Shared rule sets (versioned)
CREATE TABLE rule_sets (
    id            UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    name          NVARCHAR(200) NOT NULL,
    version       INT NOT NULL DEFAULT 1,
    definition    NVARCHAR(MAX) NOT NULL,          -- JSON rule definition
    is_latest     BIT NOT NULL DEFAULT 1,
    created_by    NVARCHAR(200) NOT NULL,
    created_at    DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Production parallels
CREATE TABLE production_parallels (
    id               UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    project_id       UNIQUEIDENTIFIER NOT NULL,
    name             NVARCHAR(200) NOT NULL,
    source_env_id    UNIQUEIDENTIFIER NOT NULL,
    source_config    NVARCHAR(MAX) NOT NULL,       -- JSON: protocol, endpoint, filter, correlationKey
    rule_set_id      UNIQUEIDENTIFIER,             -- NULL = no transform
    rule_set_version INT,                          -- pinned version; NULL = always latest
    inline_overrides NVARCHAR(MAX),               -- JSON patch on top of rule set
    target_env_id    UNIQUEIDENTIFIER NOT NULL,
    target_config    NVARCHAR(MAX) NOT NULL,       -- JSON: protocol, endpoint, rateLimit, ordering
    output_pull_config NVARCHAR(MAX),             -- JSON: SQL query or file path
    assertion_set_id UNIQUEIDENTIFIER,
    schedule_cron    NVARCHAR(100),
    created_by       NVARCHAR(200) NOT NULL,
    created_at       DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_production_parallels_projects FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT FK_production_parallels_source_env FOREIGN KEY (source_env_id) REFERENCES environments(id),
    CONSTRAINT FK_production_parallels_target_env FOREIGN KEY (target_env_id) REFERENCES environments(id)
);

-- Runs
CREATE TABLE runs (
    id               UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    parallel_id      UNIQUEIDENTIFIER NOT NULL,
    rule_set_version INT,                          -- snapshot of version used
    config_snapshot  NVARCHAR(MAX),               -- full JSON snapshot of parallel config at run time
    status           NVARCHAR(20) NOT NULL DEFAULT 'QUEUED',  -- QUEUED, RUNNING, PASSED, FAILED, CANCELLED
    started_at       DATETIME2,
    completed_at     DATETIME2,
    triggered_by     NVARCHAR(200) NOT NULL,       -- username or "scheduler" or "api"
    total_records    INT,
    matched_records  INT,
    error_message    NVARCHAR(MAX),
    created_at       DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_runs_production_parallels FOREIGN KEY (parallel_id) REFERENCES production_parallels(id)
);
CREATE INDEX IX_runs_parallel_id ON runs(parallel_id);
CREATE INDEX IX_runs_status ON runs(status);

-- Run step results (field-level diff)
CREATE TABLE run_results (
    id             UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    run_id         UNIQUEIDENTIFIER NOT NULL,
    record_key     NVARCHAR(500) NOT NULL,         -- correlation key value
    field_name     NVARCHAR(200) NOT NULL,
    expected_value NVARCHAR(MAX),
    actual_value   NVARCHAR(MAX),
    matched        BIT NOT NULL,
    mismatch_reason NVARCHAR(500),
    created_at     DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_run_results_runs FOREIGN KEY (run_id) REFERENCES runs(id)
);
CREATE INDEX IX_run_results_run_id ON run_results(run_id);
CREATE INDEX IX_run_results_matched ON run_results(run_id, matched);

-- Audit log
CREATE TABLE audit_log (
    id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    entity_type NVARCHAR(100) NOT NULL,
    entity_id   UNIQUEIDENTIFIER NOT NULL,
    action      NVARCHAR(50) NOT NULL,             -- CREATED, UPDATED, DELETED, RUN, CLONED
    actor       NVARCHAR(200) NOT NULL,
    detail      NVARCHAR(MAX),                     -- JSON diff or description
    created_at  DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_audit_log_entity ON audit_log(entity_type, entity_id);
```

## When adding a new migration

1. Check the last migration number in `src/main/resources/db/migration/`
2. Create `V{n+1}__{description}.sql`
3. Write forward-only SQL — no rollback scripts
4. For adding a column, always include `DEFAULT` and `NULL` or `NOT NULL`
5. Test the migration locally with `./mvnw flyway:migrate` before committing
