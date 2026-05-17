# Create a Database Migration

## Task

Create a new Flyway migration for ParallelIQ against SQL Server.

## Steps

1. List all existing files in `backend/src/main/resources/db/migration/` to find the current highest version number V{n}

2. Create `backend/src/main/resources/db/migration/V{n+1}__{ShortDescription}.sql`

3. Write SQL following these rules:
   - SQL Server syntax only (`NVARCHAR`, `DATETIME2`, `BIT`, `UNIQUEIDENTIFIER`, `NEWSEQUENTIALID()`)
   - New tables: include `id UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID() PRIMARY KEY`
   - New tables: include `created_at DATETIME2 DEFAULT SYSUTCDATETIME()` and `updated_at DATETIME2 DEFAULT SYSUTCDATETIME()`
   - Foreign keys named: `FK_{child_table}_{parent_table}`
   - Indexes named: `IX_{table}_{column(s)}`
   - New columns on existing tables: always specify `NULL` or `NOT NULL DEFAULT {value}`
   - Never `DROP` a column or table that has data — add a new column and migrate data in a separate step

4. Update the corresponding JPA `@Entity` class in `infrastructure/persistence/entity/`

5. Update the domain `Port` interface if new query methods are needed

6. Add the Spring Data JPA repository method if new query is needed

7. Verify by running `./mvnw flyway:validate` (checks migration checksums)

## Inputs needed

- What schema change is needed and why
- Which table(s) are affected
- Any data migration required (existing rows that need new column populated)
