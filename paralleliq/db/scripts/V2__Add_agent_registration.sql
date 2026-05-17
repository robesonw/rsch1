-- ═══════════════════════════════════════════════════════════════
-- V2__Add_agent_registration.sql
-- Adds agent_registrations table so the API tracks known agents.
-- ═══════════════════════════════════════════════════════════════

USE paralleliq;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'agent_registrations')
BEGIN
    CREATE TABLE agent_registrations (
        id                  UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        agent_id            NVARCHAR(200)    NOT NULL,
        hostname            NVARCHAR(500)    NOT NULL,
        supported_protocols NVARCHAR(MAX)    NOT NULL,   -- JSON array e.g. ["IBM_MQ","KAFKA"]
        version             NVARCHAR(50),
        last_seen_at        DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        created_at          DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        CONSTRAINT UQ_agent_registrations_agent_id UNIQUE (agent_id)
    );
    CREATE INDEX IX_agent_registrations_last_seen ON agent_registrations(last_seen_at DESC);
    PRINT 'Created agent_registrations table';
END
GO

IF NOT EXISTS (SELECT 1 FROM schema_versions WHERE version = 'V2')
BEGIN
    INSERT INTO schema_versions (version, description)
    VALUES ('V2', 'Add agent_registrations table');
    PRINT 'Recorded V2 in schema_versions';
END
GO

PRINT '=== V2 complete ===';
