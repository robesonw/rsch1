# Database Scripts — Execution Guide

No migration tool is used. Scripts are applied manually by a DBA or developer
in version order. Each script is idempotent where possible.

## How to check what has been applied

```sql
SELECT version, description, applied_at, applied_by
FROM schema_versions
ORDER BY applied_at;
```

## Execution order

| Script | Run when |
|--------|---------|
| `V1__Create_initial_schema.sql` | First-time setup only |
| `V2__Add_agent_registration.sql` | After V1 |
| `V3__Add_execution_mode.sql` | After V2 |

## How to run a script

Using SSMS:
1. Open the script file
2. Select the correct database (USE paralleliq)
3. Execute (F5)
4. Verify the `schema_versions` insert at the bottom ran successfully

Using sqlcmd:
```batch
sqlcmd -S YOUR-SERVER -d paralleliq -i V1__Create_initial_schema.sql -E
```

## Rules
- Never modify an existing script that has already been applied
- Never skip a version
- If a script fails partway through, fix the issue and re-run — scripts are written to be safe to re-run
