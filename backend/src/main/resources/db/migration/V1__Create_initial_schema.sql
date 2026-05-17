-- V1__Create_initial_schema.sql
-- ParallelIQ initial database schema for SQL Server

-- ── PROJECTS ──────────────────────────────────────────────────────────────────
CREATE TABLE projects (
    id            UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    name          NVARCHAR(200)    NOT NULL,
    description   NVARCHAR(1000),
    created_by    NVARCHAR(200)    NOT NULL,
    created_at    DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    updated_at    DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
);

-- ── ENVIRONMENTS (admin-managed, credentials via vault ref) ───────────────────
CREATE TABLE environments (
    id             UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    name           NVARCHAR(200)    NOT NULL,
    protocol       NVARCHAR(50)     NOT NULL,    -- IBM_MQ | KAFKA | SOLACE | SFTP | FILE | DATABASE
    host           NVARCHAR(500),
    port           INT,
    credential_ref NVARCHAR(500),               -- vault key — never plaintext password
    properties     NVARCHAR(MAX),               -- JSON: protocol-specific extras
    is_active      BIT              NOT NULL DEFAULT 1,
    created_by     NVARCHAR(200)    NOT NULL,
    created_at     DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    updated_at     DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
);

-- ── LOOKUP DEFINITIONS (shared, reusable enrichment sources) ──────────────────
CREATE TABLE lookup_definitions (
    id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    name        NVARCHAR(200)    NOT NULL,
    source_type NVARCHAR(50)     NOT NULL,       -- DB_QUERY | REF_FILE | STATIC
    definition  NVARCHAR(MAX)    NOT NULL,        -- JSON: SQL query, file path, or static map
    cache_ttl_s INT              DEFAULT 300,     -- seconds; 0 = no cache
    created_by  NVARCHAR(200)    NOT NULL,
    created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    updated_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
);

-- ── RULE SETS (versioned, shared transformation definitions) ──────────────────
CREATE TABLE rule_sets (
    id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    name        NVARCHAR(200)    NOT NULL,
    version     INT              NOT NULL DEFAULT 1,
    definition  NVARCHAR(MAX)    NOT NULL,        -- JSON: array of FieldRule objects
    is_latest   BIT              NOT NULL DEFAULT 1,
    created_by  NVARCHAR(200)    NOT NULL,
    created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    updated_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
);
CREATE INDEX IX_rule_sets_name_latest ON rule_sets(name, is_latest);

-- ── ASSERTION SETS (versioned, shared comparison rule definitions) ─────────────
CREATE TABLE assertion_sets (
    id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    name        NVARCHAR(200)    NOT NULL,
    version     INT              NOT NULL DEFAULT 1,
    definition  NVARCHAR(MAX)    NOT NULL,        -- JSON: array of FieldAssertion objects
    is_latest   BIT              NOT NULL DEFAULT 1,
    created_by  NVARCHAR(200)    NOT NULL,
    created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    updated_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
);

-- ── PRODUCTION PARALLELS ───────────────────────────────────────────────────────
CREATE TABLE production_parallels (
    id                   UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    project_id           UNIQUEIDENTIFIER NOT NULL,
    name                 NVARCHAR(200)    NOT NULL,
    description          NVARCHAR(1000),
    source_env_id        UNIQUEIDENTIFIER NOT NULL,
    source_config        NVARCHAR(MAX)    NOT NULL,  -- JSON: endpoint, filter, correlationKey, captureMode, duration
    rule_set_id          UNIQUEIDENTIFIER,
    rule_set_version     INT,                        -- NULL = always latest
    inline_overrides     NVARCHAR(MAX),              -- JSON patch applied on top of rule set
    target_env_id        UNIQUEIDENTIFIER NOT NULL,
    target_config        NVARCHAR(MAX)    NOT NULL,  -- JSON: endpoint, rateLimit, ordering
    output_pull_config   NVARCHAR(MAX),              -- JSON: type (DB_QUERY|FILE), query/path
    assertion_set_id     UNIQUEIDENTIFIER,
    assertion_set_version INT,
    schedule_cron        NVARCHAR(100),
    created_by           NVARCHAR(200)    NOT NULL,
    created_at           DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    updated_at           DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    CONSTRAINT FK_production_parallels_projects       FOREIGN KEY (project_id)      REFERENCES projects(id),
    CONSTRAINT FK_production_parallels_source_env     FOREIGN KEY (source_env_id)   REFERENCES environments(id),
    CONSTRAINT FK_production_parallels_target_env     FOREIGN KEY (target_env_id)   REFERENCES environments(id),
    CONSTRAINT FK_production_parallels_rule_sets      FOREIGN KEY (rule_set_id)     REFERENCES rule_sets(id),
    CONSTRAINT FK_production_parallels_assertion_sets FOREIGN KEY (assertion_set_id) REFERENCES assertion_sets(id)
);
CREATE INDEX IX_production_parallels_project_id ON production_parallels(project_id);

-- ── RUNS ───────────────────────────────────────────────────────────────────────
CREATE TABLE runs (
    id               UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    parallel_id      UNIQUEIDENTIFIER NOT NULL,
    rule_set_version INT,
    config_snapshot  NVARCHAR(MAX),               -- full JSON snapshot of parallel config at run time
    status           NVARCHAR(20)     NOT NULL DEFAULT 'QUEUED',
    started_at       DATETIME2,
    completed_at     DATETIME2,
    triggered_by     NVARCHAR(200)    NOT NULL,
    params           NVARCHAR(MAX),               -- JSON: runtime params (e.g. {batchDate:"2026-05-01"})
    total_records    INT,
    matched_records  INT,
    error_message    NVARCHAR(MAX),
    created_at       DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    CONSTRAINT FK_runs_production_parallels FOREIGN KEY (parallel_id) REFERENCES production_parallels(id)
);
CREATE INDEX IX_runs_parallel_id ON runs(parallel_id);
CREATE INDEX IX_runs_status ON runs(status);
CREATE INDEX IX_runs_started_at ON runs(started_at DESC);

-- ── RUN RESULTS (field-level diff) ────────────────────────────────────────────
CREATE TABLE run_results (
    id               UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    run_id           UNIQUEIDENTIFIER NOT NULL,
    record_key       NVARCHAR(500)    NOT NULL,    -- correlation key value
    field_name       NVARCHAR(200)    NOT NULL,
    expected_value   NVARCHAR(MAX),
    actual_value     NVARCHAR(MAX),
    matched          BIT              NOT NULL,
    mismatch_reason  NVARCHAR(500),
    created_at       DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    CONSTRAINT FK_run_results_runs FOREIGN KEY (run_id) REFERENCES runs(id)
);
CREATE INDEX IX_run_results_run_id   ON run_results(run_id);
CREATE INDEX IX_run_results_mismatches ON run_results(run_id, matched) WHERE matched = 0;

-- ── AUDIT LOG ──────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
    id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    entity_type NVARCHAR(100)    NOT NULL,        -- e.g. ProductionParallel, RuleSet, Run
    entity_id   UNIQUEIDENTIFIER NOT NULL,
    action      NVARCHAR(50)     NOT NULL,        -- CREATED | UPDATED | DELETED | RUN | CLONED
    actor       NVARCHAR(200)    NOT NULL,
    detail      NVARCHAR(MAX),                    -- JSON diff or description
    created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
);
CREATE INDEX IX_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IX_audit_log_actor  ON audit_log(actor);
