# Create a Database Migration

## Rules — no Flyway

ParallelIQ uses manual SQL scripts, not Flyway. Every schema change is a new numbered file.

## Steps

### 1. Find the current highest version
Look in `db/scripts/` — find the file with the highest V number.

### 2. Create the new script
File: `db/scripts/V{n+1}__Short_description.sql`

Use this template exactly:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- V{n+1}__Short_description.sql
-- What this script adds and why (one paragraph).
-- ═══════════════════════════════════════════════════════════════════

USE paralleliq;
GO

-- New table (use IF NOT EXISTS on all DDL)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'new_table')
BEGIN
    CREATE TABLE new_table (
        id            UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
        -- your columns here, e.g.:
        name          NVARCHAR(200)    NOT NULL,
        description   NVARCHAR(1000),
        is_active     BIT              NOT NULL DEFAULT 1,
        created_by    NVARCHAR(200)    NOT NULL,
        created_at    DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        updated_at    DATETIME2        DEFAULT SYSUTCDATETIME() NOT NULL,
        CONSTRAINT FK_new_table_parent FOREIGN KEY (parent_id) REFERENCES parent(id)
    );
    CREATE INDEX IX_new_table_name ON new_table(name);
    PRINT 'Created new_table';
END
GO

-- Adding a column to existing table
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('existing_table') AND name = 'new_column'
)
BEGIN
    ALTER TABLE existing_table ADD new_column NVARCHAR(200) NULL;
    PRINT 'Added new_column to existing_table';
END
GO

-- Record this migration (mandatory — always last)
IF NOT EXISTS (SELECT 1 FROM schema_versions WHERE version = 'V{n+1}')
BEGIN
    INSERT INTO schema_versions (version, description)
    VALUES ('V{n+1}', 'Short description matching filename');
    PRINT 'Recorded V{n+1} in schema_versions';
END
GO

PRINT '=== V{n+1} complete ===';
```

### 3. Update the JPA entity
File: `paralleliq-api/src/main/java/com/paralleliq/api/infrastructure/persistence/entity/{Name}Entity.java`
- Add or update `@Entity` class to match the new schema
- New column = new field with `@Column`
- New table = new `@Entity` class

### 4. Update repository if new query needed
File: `paralleliq-api/src/main/java/com/paralleliq/api/infrastructure/persistence/repository/{Name}Repository.java`
- Add Spring Data JPA method or `@Query`

### 5. Update db/scripts/README.md
Add the new script to the execution order table.

### 6. Verify (run locally)
```bash
sqlcmd -S localhost -d paralleliq -i db/scripts/V{n+1}__Short_description.sql -E
sqlcmd -S localhost -d paralleliq -Q "SELECT * FROM schema_versions ORDER BY applied_at"
```

## SQL Server rules

- Use `NVARCHAR` not `VARCHAR`
- Use `DATETIME2` not `DATETIME`
- Use `BIT` not `BOOLEAN`
- Primary keys: `UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()`
- Timestamps: `DATETIME2 DEFAULT SYSUTCDATETIME()`
- Foreign keys: `FK_{child_table}_{parent_table}`
- Indexes: `IX_{table}_{column(s)}`

## Inputs needed

- What schema change is needed and why
- Which table(s) are affected (new or existing)
- Column names, types, and constraints
- Any FK relationships needed
- Any data migration required for existing rows
