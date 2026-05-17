-- ═══════════════════════════════════════════════════════════════════
-- V1__Create_initial_schema.sql
-- ParallelIQ — Initial database schema for SQL Server
-- Run once on a new database.
-- ═══════════════════════════════════════════════════════════════════

USE paralleliq;
GO

-- ── Version tracking (replaces Flyway) ───────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'schema_versions')
BEGIN
    CREATE TABLE schema_versions (
        version     NVARCHAR(20)  NOT NULL PRIMARY KEY,
        description NVARCHAR(200) NOT NULL,
        applied_at  DATETIME2     DEFAULT SYSUTCDATETIME() NOT NULL,
        applied_by  NVARCHAR(100) DEFAULT SYSTEM_USER NOT NULL
    );
    PRINT 'Created schema_versions table';
END
GO

-- ── Projects ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'projects')
BEGIN
    CREATE TABLE projects (
        id            UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        name          NVARCHAR(200)    NOT NULL,
        description   NVARCHAR(1000),
        created_by    NVARCHAR(200)    NOT NULL,
        created_at    DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        updated_at    DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
    );
    PRINT 'Created projects table';
END
GO

-- ── Environments (admin-managed, credentials via vault ref or env var) ─
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'environments')
BEGIN
    CREATE TABLE environments (
        id             UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        name           NVARCHAR(200)    NOT NULL,
        protocol       NVARCHAR(50)     NOT NULL,
        host           NVARCHAR(500),
        port           INT,
        credential_ref NVARCHAR(500),
        properties     NVARCHAR(MAX),
        is_active      BIT              NOT NULL DEFAULT 1,
        created_by     NVARCHAR(200)    NOT NULL,
        created_at     DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        updated_at     DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
    );
    PRINT 'Created environments table';
END
GO

-- ── Rule sets (versioned) ─────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rule_sets')
BEGIN
    CREATE TABLE rule_sets (
        id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        name        NVARCHAR(200)    NOT NULL,
        version     INT              NOT NULL DEFAULT 1,
        definition  NVARCHAR(MAX)    NOT NULL,
        is_latest   BIT              NOT NULL DEFAULT 1,
        created_by  NVARCHAR(200)    NOT NULL,
        created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        updated_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
    );
    CREATE INDEX IX_rule_sets_name_latest ON rule_sets(name, is_latest);
    PRINT 'Created rule_sets table';
END
GO

-- ── Assertion sets (versioned) ────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'assertion_sets')
BEGIN
    CREATE TABLE assertion_sets (
        id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        name        NVARCHAR(200)    NOT NULL,
        version     INT              NOT NULL DEFAULT 1,
        definition  NVARCHAR(MAX)    NOT NULL,
        is_latest   BIT              NOT NULL DEFAULT 1,
        created_by  NVARCHAR(200)    NOT NULL,
        created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        updated_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
    );
    PRINT 'Created assertion_sets table';
END
GO

-- ── Lookup definitions ────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'lookup_definitions')
BEGIN
    CREATE TABLE lookup_definitions (
        id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        name        NVARCHAR(200)    NOT NULL,
        source_type NVARCHAR(50)     NOT NULL,
        definition  NVARCHAR(MAX)    NOT NULL,
        cache_ttl_s INT              DEFAULT 300,
        created_by  NVARCHAR(200)    NOT NULL,
        created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        updated_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
    );
    PRINT 'Created lookup_definitions table';
END
GO

-- ── Production parallels ──────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'production_parallels')
BEGIN
    CREATE TABLE production_parallels (
        id                    UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        project_id            UNIQUEIDENTIFIER NOT NULL,
        name                  NVARCHAR(200)    NOT NULL,
        description           NVARCHAR(1000),
        execution_mode        NVARCHAR(30)     NOT NULL DEFAULT 'REPLAY_VALIDATE',
        source_env_id         UNIQUEIDENTIFIER NOT NULL,
        source_config         NVARCHAR(MAX)    NOT NULL,
        rule_set_id           UNIQUEIDENTIFIER,
        rule_set_version      INT,
        inline_overrides      NVARCHAR(MAX),
        target_env_id         UNIQUEIDENTIFIER NOT NULL,
        target_config         NVARCHAR(MAX)    NOT NULL,
        output_pull_config    NVARCHAR(MAX),
        assertion_set_id      UNIQUEIDENTIFIER,
        assertion_set_version INT,
        schedule_cron         NVARCHAR(100),
        created_by            NVARCHAR(200)    NOT NULL,
        created_at            DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        updated_at            DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        CONSTRAINT FK_parallels_projects       FOREIGN KEY (project_id)      REFERENCES projects(id),
        CONSTRAINT FK_parallels_source_env     FOREIGN KEY (source_env_id)   REFERENCES environments(id),
        CONSTRAINT FK_parallels_target_env     FOREIGN KEY (target_env_id)   REFERENCES environments(id),
        CONSTRAINT FK_parallels_rule_sets      FOREIGN KEY (rule_set_id)     REFERENCES rule_sets(id),
        CONSTRAINT FK_parallels_assertion_sets FOREIGN KEY (assertion_set_id) REFERENCES assertion_sets(id)
    );
    CREATE INDEX IX_parallels_project_id ON production_parallels(project_id);
    PRINT 'Created production_parallels table';
END
GO

-- ── Runs ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'runs')
BEGIN
    CREATE TABLE runs (
        id               UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        parallel_id      UNIQUEIDENTIFIER NOT NULL,
        config_snapshot  NVARCHAR(MAX),
        status           NVARCHAR(20)     NOT NULL DEFAULT 'QUEUED',
        agent_id         NVARCHAR(200),
        started_at       DATETIME2,
        completed_at     DATETIME2,
        triggered_by     NVARCHAR(200)    NOT NULL,
        params           NVARCHAR(MAX),
        total_records    INT,
        matched_records  INT,
        error_message    NVARCHAR(MAX),
        created_at       DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        CONSTRAINT FK_runs_parallels FOREIGN KEY (parallel_id) REFERENCES production_parallels(id)
    );
    CREATE INDEX IX_runs_parallel_id ON runs(parallel_id);
    CREATE INDEX IX_runs_status      ON runs(status);
    CREATE INDEX IX_runs_started_at  ON runs(started_at DESC);
    PRINT 'Created runs table';
END
GO

-- ── Run results (field-level diff) ───────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'run_results')
BEGIN
    CREATE TABLE run_results (
        id               UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        run_id           UNIQUEIDENTIFIER NOT NULL,
        record_key       NVARCHAR(500)    NOT NULL,
        field_name       NVARCHAR(200)    NOT NULL,
        expected_value   NVARCHAR(MAX),
        actual_value     NVARCHAR(MAX),
        matched          BIT              NOT NULL,
        mismatch_reason  NVARCHAR(500),
        environment_role NVARCHAR(10)     NOT NULL DEFAULT 'ENV_B',
        created_at       DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        CONSTRAINT FK_run_results_runs FOREIGN KEY (run_id) REFERENCES runs(id)
    );
    CREATE INDEX IX_run_results_run_id    ON run_results(run_id);
    CREATE INDEX IX_run_results_mismatches ON run_results(run_id, matched)
        WHERE matched = 0;
    PRINT 'Created run_results table';
END
GO

-- ── Audit log ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_log')
BEGIN
    CREATE TABLE audit_log (
        id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        entity_type NVARCHAR(100)    NOT NULL,
        entity_id   UNIQUEIDENTIFIER NOT NULL,
        action      NVARCHAR(50)     NOT NULL,
        actor       NVARCHAR(200)    NOT NULL,
        detail      NVARCHAR(MAX),
        created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
    );
    CREATE INDEX IX_audit_log_entity ON audit_log(entity_type, entity_id);
    PRINT 'Created audit_log table';
END
GO

-- ── Project memberships (RBAC) ────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'project_memberships')
BEGIN
    CREATE TABLE project_memberships (
        id         UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        project_id UNIQUEIDENTIFIER NOT NULL,
        username   NVARCHAR(200)    NOT NULL,
        role       NVARCHAR(50)     NOT NULL,
        granted_by NVARCHAR(200)    NOT NULL,
        created_at DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        CONSTRAINT FK_memberships_projects FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT UQ_project_memberships  UNIQUE (project_id, username)
    );
    CREATE INDEX IX_memberships_username ON project_memberships(username);
    PRINT 'Created project_memberships table';
END
GO

-- ── ShedLock (prevents duplicate scheduled jobs across API instances) ─
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'shedlock')
BEGIN
    CREATE TABLE shedlock (
        name       NVARCHAR(64)  NOT NULL PRIMARY KEY,
        lock_until DATETIME2     NOT NULL,
        locked_at  DATETIME2     NOT NULL,
        locked_by  NVARCHAR(255) NOT NULL
    );
    PRINT 'Created shedlock table';
END
GO

-- ── Record this migration ─────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM schema_versions WHERE version = 'V1')
BEGIN
    INSERT INTO schema_versions (version, description)
    VALUES ('V1', 'Create initial schema — all core tables');
    PRINT 'Recorded V1 in schema_versions';
END
GO

PRINT '=== V1 complete ===';
