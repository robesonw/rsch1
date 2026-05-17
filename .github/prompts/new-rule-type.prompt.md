# Add a New Transform Rule Type

## Task

Add a new field-level transformation rule type to the ParallelIQ transform engine.

## What to build

1. **Add to `RuleType` enum** at `domain/model/RuleType.java`
   - e.g. `REGEX_EXTRACT`, `CONDITIONAL`, `AGGREGATE`

2. **Rule definition class** at `domain/model/rule/{RuleTypeName}Rule.java`
   - Extends or implements `FieldRule`
   - Fields: all config needed to execute this rule
   - Plain Java record

3. **Rule executor** at `domain/service/transform/{RuleTypeName}RuleExecutor.java`
   - Implements `RuleExecutor<{RuleTypeName}Rule>`
   - `execute(String inputValue, {RuleTypeName}Rule rule, LookupContext context)` returns `String`
   - Unit tests covering: happy path, null input, invalid config, edge cases

4. **Register in `TransformService`** at `domain/service/TransformService.java`
   - Add to the executor registry map

5. **JSON serialisation** — ensure the rule definition deserialises correctly from the JSON stored in `rule_sets.definition`:
   - Add `@JsonSubTypes` entry if using Jackson polymorphism
   - Or add a case to `RuleDefinitionDeserializer`

6. **Frontend — rule editor UI** at `frontend/src/components/ruleset/rules/{RuleTypeName}RuleEditor.tsx`
   - Form fields for configuring this rule type
   - Inline help text explaining what the rule does
   - Preview showing input → output example

7. **Update `docs/rule-types.md`** with the new type, its config fields, and an example

## Inputs needed

- Rule type name and what it does (e.g. "Extracts a substring using a regex capture group")
- Input: what the rule receives (a field value as String, plus context)
- Config: what parameters the tester sets (regex pattern, group number, etc.)
- Output: what the rule returns
- Error cases: what should happen if the regex doesn't match
