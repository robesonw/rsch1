# Debug a Result Mismatch

## Task

Investigate and fix a field comparison mismatch in a ParallelIQ run result.

## Investigation steps for Copilot

1. **Find the run result** — query `run_results` for the `run_id` and `record_key` in question:
   ```sql
   SELECT field_name, expected_value, actual_value, mismatch_reason
   FROM run_results
   WHERE run_id = '{runId}' AND record_key = '{recordKey}' AND matched = 0
   ```

2. **Trace the transform** — find the rule that mapped this field in the rule set:
   - Check `rule_sets.definition` JSON for the field mapping
   - Identify the `RuleType` (DIRECT, DATE_FORMAT, LOOKUP, ENV_SWAP, etc.)
   - Check if an inline override is present in `production_parallels.inline_overrides`

3. **Check the lookup** (if rule type is LOOKUP):
   - Verify the lookup definition in `lookup_definitions` table
   - Check if the lookup key exists and returns the expected value
   - Check lookup cache TTL — is it stale?

4. **Check env swap** (if rule type is ENV_SWAP):
   - Verify the swap map in the rule set definition has the correct source env value → target env value mapping
   - Check for case sensitivity issues

5. **Check date format** (if field is a date):
   - Verify source format matches `SourceBinding.dateFormat` config
   - Verify target format matches `TargetBinding.dateFormat` config
   - Check for timezone issues (`Z` suffix vs no suffix is a common mismatch)

6. **Check assertion tolerance** (if numerical field):
   - Verify `AssertionSet` tolerance for this field
   - `0.01` numeric tolerance may not cover floating-point rounding across environments

7. **Write a failing unit test** that reproduces the mismatch:
   ```java
   @Test
   void shouldHandleEdgeCaseForField() { ... }
   ```

8. **Fix** the rule, lookup, or assertion tolerance and re-run

## Inputs needed

- Run ID
- Record key (correlation key value)
- Field name that mismatched
- Expected value
- Actual value
