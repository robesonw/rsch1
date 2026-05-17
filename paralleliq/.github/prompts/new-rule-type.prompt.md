# Add a New Transform Rule Type

## Where rule types live

Rule execution is in `paralleliq-agent` — the agent applies rules during the TRANSFORM step.
Rule set definitions (JSON) are stored in the API's database and sent to the agent in the `RunAssignment`.

## What to build

### 1. Add to RuleType enum
File: `paralleliq-agent/src/main/java/com/paralleliq/agent/transform/RuleType.java`
Add the new enum value (e.g. `REGEX_EXTRACT`, `CONDITIONAL`, `NUMERIC_FORMAT`).

### 2. Rule config class
File: `paralleliq-agent/src/main/java/com/paralleliq/agent/transform/rules/{Name}Rule.java`

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class {Name}Rule {
    private String sourceField;
    private String targetField;
    private RuleType ruleType;          // = RuleType.{NAME}
    // config fields specific to this rule type:
    // e.g. private String pattern;
    //      private int groupIndex;
    //      private String defaultValue;
}
```

### 3. Rule executor
File: `paralleliq-agent/src/main/java/com/paralleliq/agent/transform/executors/{Name}RuleExecutor.java`

```java
@Component
public class {Name}RuleExecutor implements RuleExecutor {

    @Override
    public RuleType supports() { return RuleType.{NAME}; }

    @Override
    public String execute(String inputValue, Object ruleConfig, LookupContext ctx) {
        {Name}Rule rule = ({Name}Rule) ruleConfig;
        if (inputValue == null) {
            return rule.getDefaultValue();  // null-safe always
        }
        try {
            // ... implementation
        } catch (Exception e) {
            throw new TransformException(
                "Rule " + RuleType.{NAME} + " failed on value '" + inputValue + "': " + e.getMessage());
        }
    }
}
```

### 4. Register in TransformService
File: `paralleliq-agent/src/main/java/com/paralleliq/agent/transform/TransformService.java`

Spring auto-discovers all `RuleExecutor` beans via a list injection — no manual registration needed if `@Component` is present.

### 5. Unit tests
File: `paralleliq-agent/src/test/java/com/paralleliq/agent/transform/executors/{Name}RuleExecutorTest.java`

Required test cases:
- Happy path — correct transformation
- Null input — returns default value (never throws NPE)
- Invalid config — throws `TransformException` with clear message
- Edge case specific to this rule type

### 6. Frontend — rule editor component
File: `paralleliq-ui/src/components/ruleset/rules/{Name}RuleEditor.tsx`

A form for configuring this rule type in the rule set editor.
Include inline help text explaining what the rule does and an example showing input → output.

### 7. Update types
File: `paralleliq-ui/src/types/index.ts`

Add the new rule type to:
```typescript
export type RuleType =
  | 'DIRECT'
  | 'DATE_FORMAT'
  | 'LOOKUP'
  | 'ENV_SWAP'
  | '{NAME}'   // ← add here
  // ...
```

## Inputs needed

- Rule type name and what it does
- Input: what the rule receives (field value as String, plus lookup context)
- Config fields: what the tester configures (e.g. regex pattern, group index)
- Output: what the rule returns
- Null/empty input behaviour
- Error cases
