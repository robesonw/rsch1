---
applyTo: "db/scripts/**/*.sql"
---

# Database Instructions — Manual SQL Scripts (No Flyway)

## Core rules

- No Flyway dependency anywhere — schema is managed by numbered scripts in `db/scripts/`
- Every script is **idempotent** — wrap all DDL in `IF NOT EXISTS` guards so scripts can be re-run safely
- Every script ends with an `INSERT INTO schema_versions` row
- New schema change = new file `V{n+1}__Short_description.sql`
- Never modify an existing script that has already been applied to any environment
- SQL Server syntax only — `NVARCHAR`, `DATETIME2`, `BIT`, `UNIQUEIDENTIFIER`, `NEWSEQUENTIALID()`

## Standard table structure

Every new table must include:
```sql
id         UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
created_at DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
updated_at DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
```

## Naming conventions

| Object | Pattern | Example |
|--------|---------|---------|
| Foreign key | `FK_{child}_{parent}` | `FK_runs_parallels` |
| Index | `IX_{table}_{columns}` | `IX_runs_status` |
| Unique constraint | `UQ_{table}_{columns}` | `UQ_agent_registrations_agent_id` |

## Script template

```sql
-- ═══════════════════════════════════════════════════════════════════
-- V{n}__Description.sql
-- What this script adds and why.
-- ═══════════════════════════════════════════════════════════════════

USE paralleliq;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'new_table')
BEGIN
    CREATE TABLE new_table (
        id          UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        -- columns here
        created_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        updated_at  DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL
    );
    CREATE INDEX IX_new_table_relevant_column ON new_table(relevant_column);
    PRINT 'Created new_table';
END
GO

-- Adding a column to existing table:
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('existing_table') AND name = 'new_column'
)
BEGIN
    ALTER TABLE existing_table ADD new_column NVARCHAR(200) NULL;
    PRINT 'Added new_column to existing_table';
END
GO

IF NOT EXISTS (SELECT 1 FROM schema_versions WHERE version = 'V{n}')
BEGIN
    INSERT INTO schema_versions (version, description)
    VALUES ('V{n}', 'Short description matching filename');
    PRINT 'Recorded V{n} in schema_versions';
END
GO

PRINT '=== V{n} complete ===';
```

## When Copilot adds a new feature requiring schema changes

1. Check the highest existing version in `db/scripts/`
2. Create `V{n+1}__Description.sql` using the template above
3. Update the corresponding JPA `@Entity` class in `paralleliq-api/src/main/java/com/paralleliq/api/infrastructure/persistence/entity/`
4. Add the Spring Data JPA repository method if a new query is needed
5. Update `README.md` in `db/scripts/` with the new entry in the execution order table
6. Never use `spring.jpa.hibernate.ddl-auto=create` or `update` — validate only

## Running scripts

```bash
# Using sqlcmd
sqlcmd -S YOUR-SERVER -d paralleliq -i db/scripts/V3__New_feature.sql -E

# Verify applied
sqlcmd -S YOUR-SERVER -d paralleliq -Q "SELECT * FROM schema_versions ORDER BY applied_at"
```
