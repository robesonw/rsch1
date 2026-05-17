# Debug a Result Mismatch

## Task

Investigate and fix a field comparison mismatch in a ParallelIQ run result.

## Investigation steps

### 1. Find the failing records
Query SQL Server:
```sql
SELECT record_key, field_name, expected_value, actual_value, mismatch_reason, environment_role
FROM run_results
WHERE run_id = '{runId}' AND matched = 0
ORDER BY record_key, field_name;
```

### 2. Check the execution mode
```sql
SELECT r.id, r.status, p.execution_mode, r.config_snapshot
FROM runs r
JOIN production_parallels p ON r.parallel_id = p.id
WHERE r.id = '{runId}';
```

- `REPLAY_VALIDATE`: expected = Env A baseline, actual = Env B output
- `TRUE_PARALLEL`: env_a_value vs env_b_value — neither is definitive

### 3. Find the rule that maps the failing field

The run's `config_snapshot` column contains the full rule set JSON used.
Parse `config_snapshot -> ruleSetDefinition -> fieldRules` and find the entry for the failing `field_name`.

Identify the `ruleType`:
- `DIRECT` — field copied as-is: check source field name mapping
- `DATE_FORMAT` — check format patterns on source vs target binding
- `LOOKUP` — check the lookup definition resolves correctly
- `ENV_SWAP` — check the substitution map has the right env-A value → env-B value mapping
- `REGEX_EXTRACT` — check the regex pattern and group index

### 4. Check lookup resolution (if LOOKUP rule)
```sql
SELECT * FROM lookup_definitions WHERE name = '{lookupName}';
```
Test the lookup query manually with the failing key value.
Common causes: key not found, cache stale (check `cache_ttl_s`), lookup source changed.

### 5. Check date format mismatch (if date field)
Common causes:
- Timezone suffix: `2026-03-01T00:00:00Z` vs `2026-03-01T00:00:00` — one has UTC marker
- Format: `dd/MM/yyyy` vs `yyyy-MM-dd`
- Source format config in source binding vs actual format from the source system

### 6. Check env swap map
The env swap map lives in the rule set definition JSON.
Verify `sourceValue` matches exactly (case-sensitive) what Env A sends.

### 7. Check assertion tolerance (if numeric)
Look at the assertion set definition for this field.
`NUMERIC_TOLERANCE` assertions have a configurable delta — may need increasing for floating-point fields.

### 8. Write a failing unit test (paralleliq-agent)

Reproduce the mismatch in a unit test before fixing:

```java
// paralleliq-agent/src/test/java/com/paralleliq/agent/transform/executors/{RuleType}RuleExecutorTest.java
@Test
public void shouldHandleEdgeCaseForField() {
    String input = "{actual input value from the failing record}";
    {RuleType}Rule rule = {RuleType}Rule.builder()
        // ... config from the run's rule set JSON
        .build();

    String result = executor.execute(input, rule, emptyContext());

    assertThat(result).isEqualTo("{expected output value}");
}
```

### 9. Fix and verify
- Fix the rule config, lookup definition, or assertion tolerance
- Re-run the failing test
- If the fix changes a rule set: create a new version (increment `version`, set `is_latest=1`, clear old `is_latest`)
- If the fix changes a lookup: update `lookup_definitions` table

## Inputs needed

- Run ID (from the UI or `runs` table)
- Record key (correlation key value of the failing record)
- Field name that mismatched
- Expected value
- Actual value
- Environment role (`ENV_B` for REPLAY_VALIDATE, `ENV_A`/`ENV_B` for TRUE_PARALLEL)
