-- V2__Add_shedlock_and_project_memberships.sql
-- ShedLock table (prevents duplicate scheduled job execution across instances)
CREATE TABLE shedlock (
    name       NVARCHAR(64)  NOT NULL,
    lock_until DATETIME2     NOT NULL,
    locked_at  DATETIME2     NOT NULL,
    locked_by  NVARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);

-- Project-level role memberships (M6-E3: RBAC hardening)
CREATE TABLE project_memberships (
    id         UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    project_id UNIQUEIDENTIFIER NOT NULL,
    username   NVARCHAR(200)    NOT NULL,
    role       NVARCHAR(50)     NOT NULL,  -- TESTER | ENGINEER | ADMIN
    granted_by NVARCHAR(200)    NOT NULL,
    created_at DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
    CONSTRAINT FK_project_memberships_projects FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT UQ_project_memberships UNIQUE (project_id, username)
);
CREATE INDEX IX_project_memberships_username ON project_memberships(username);
