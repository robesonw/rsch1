---
applyTo: "backend/src/main/java/com/paralleliq/infrastructure/connector/**/*.java"
---

# Connector Implementation Instructions

## The Contract

Every connector implements `ConnectorPort` in `domain/port/ConnectorPort.java`:

```java
public interface ConnectorPort {
    Protocol supports();
    List<CapturedMessage> capture(SourceBinding binding, CaptureOptions options) throws ConnectorException;
    void replay(List<TransformedMessage> messages, TargetBinding binding, ReplayOptions options) throws ConnectorException;
}
```

The execution engine calls connectors only through this interface. Connectors never know about runs, rule sets, or assertions.

## CapturedMessage Structure

```java
// domain/model/CapturedMessage.java
public record CapturedMessage(
    String correlationKey,
    byte[] payload,
    Map<String, String> headers,
    Instant capturedAt,
    Protocol protocol
) {}
```

## ConnectorRegistry

After implementing a connector, register it in `infrastructure/config/ConnectorRegistry.java`:

```java
@Component
@RequiredArgsConstructor
public class ConnectorRegistry {
    private final List<ConnectorPort> connectors;

    public ConnectorPort forProtocol(Protocol protocol) {
        return connectors.stream()
            .filter(c -> c.supports() == protocol)
            .findFirst()
            .orElseThrow(() -> new ConnectorException("No connector for protocol: " + protocol));
    }
}
```

Spring auto-discovers all `ConnectorPort` beans — no manual registration needed.

## IBM MQ Connector Notes

- Use IBM MQ Spring Boot starter (`com.ibm.mq:mq-jms-spring-boot-starter`)
- Preserve MQMD metadata fields: `CorrelId`, `MsgId`, `Format`, `Persistence`
- Set `JMSCorrelationID` on replayed messages from the captured `correlationKey`
- Handle `MQException` and wrap in `ConnectorException` with the MQ reason code in the message
- Connection factory configured via `MQConnectionFactoryCustomizer` in the connector — not application.yml (credentials come from the `Environment.credentialRef` vault lookup)

## Kafka Connector Notes

- Use `spring-kafka` (`KafkaConsumer` / `KafkaProducer` APIs directly, not `@KafkaListener` — capture is on-demand, not continuous subscription)
- Preserve partition key and all record headers
- For capture: seek to beginning of partition if `CaptureOptions.fromBeginning` is true
- For replay: use `ProducerRecord` with the original headers restored
- Consumer group ID: `paralleliq-capture-{runId}` (unique per run to avoid offset conflicts)

## Solace Connector Notes

- Use Solace JCSMP API (`com.solacesystems:sol-jcsmp`)
- Preserve Solace user properties and application message ID
- For replay: set `DeliveryMode.PERSISTENT` unless `ReplayOptions.fireAndForget` is true
- Dead message queue routing: if `ReplayOptions.dmq` is set, configure as the replay target's DMQ

## SFTP Connector Notes

- Use Apache Commons VFS2 (`org.apache.commons:commons-vfs2`)
- For capture: list files matching `SourceBinding.filePattern` (glob), read each, return as `CapturedMessage` with filename as `correlationKey`
- For replay: write each `TransformedMessage` to `TargetBinding.outputPath` using naming pattern from `ReplayOptions.fileNamingPattern`
- Support PGP encryption if `ReplayOptions.pgpKeyRef` is set

## File Connector Notes

- Local filesystem version of the SFTP connector
- Used for CSV, JSON, XML, Excel inputs
- `capture()` reads and parses the file based on format detected from extension
- Returns one `CapturedMessage` per row (CSV/Excel) or per root element (JSON array / XML elements)

## Error Handling in Connectors

```java
try {
    // protocol-specific code
} catch (SomeProtocolException e) {
    throw new ConnectorException(
        "Failed to capture from " + binding.endpoint() + ": " + e.getMessage(),
        e,
        Protocol.KAFKA  // or whichever protocol
    );
}
```

Never swallow exceptions. Never return empty lists silently on error.
