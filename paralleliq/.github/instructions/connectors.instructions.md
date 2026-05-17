---
applyTo: "paralleliq-agent/src/main/java/com/paralleliq/agent/connector/**/*.java"
---

# Connector Implementation Instructions

## Where connectors live

All connectors are in `paralleliq-agent` only.
The `paralleliq-api` has zero connector dependencies — no MQ/Kafka/Solace/SFTP imports.

```
paralleliq-agent/src/main/java/com/paralleliq/agent/connector/
├── ConnectorPort.java          ← interface — every connector implements this
├── ConnectorRegistry.java      ← auto-discovers all ConnectorPort beans
├── mq/
│   └── IbmMqConnector.java
├── kafka/
│   └── KafkaConnector.java
├── solace/
│   └── SolaceConnector.java
├── sftp/
│   └── SftpConnector.java
├── file/
│   └── FileConnector.java
└── db/
    └── DbConnector.java
```

## The contract — ConnectorPort

```java
public interface ConnectorPort {
    Protocol supports();
    List<CapturedMessage> capture(String endpoint,
                                   Map<String, String> options,
                                   Map<String, String> connProps);
    void replay(List<TransformedMessage> messages,
                String endpoint,
                Map<String, String> options,
                Map<String, String> connProps);
}
```

`connProps` — resolved connection properties from the API's Environment config:
host, port, queueManager, channel, username, password (never stored in agent config).

`options` — run-time capture/replay settings:
captureMode, durationSeconds, maxMessages, correlationKey, filter, ratePerSecond.

## ConnectorRegistry — auto-discovery

```java
@Component
@RequiredArgsConstructor
public class ConnectorRegistry {

    private final List<ConnectorPort> connectors;  // Spring injects all implementations

    public ConnectorPort forProtocol(Protocol protocol) {
        return connectors.stream()
            .filter(c -> c.supports() == protocol)
            .findFirst()
            .orElseThrow(() -> new ConnectorException(
                "No connector for protocol: " + protocol, protocol));
    }
}
```

Adding a new protocol = implement `ConnectorPort` + add to `Protocol` enum in common. No other changes.

## IBM MQ Connector — key implementation notes

```java
@Component
@Slf4j
public class IbmMqConnector implements ConnectorPort {

    @Override
    public Protocol supports() { return Protocol.IBM_MQ; }

    @Override
    public List<CapturedMessage> capture(String endpoint,
                                          Map<String, String> options,
                                          Map<String, String> connProps) {
        MQQueueManager qMgr = null;
        try {
            MQEnvironment.hostname   = connProps.get("host");
            MQEnvironment.port       = Integer.parseInt(connProps.get("port"));
            MQEnvironment.channel    = connProps.get("channel");
            MQEnvironment.userID     = connProps.get("username");
            MQEnvironment.password   = connProps.get("password");
            // TLS set via JVM args in run.bat — not here

            qMgr = new MQQueueManager(connProps.get("queueManager"));
            // ... capture logic
        } catch (MQException e) {
            throw new ConnectorException(
                "MQ capture failed [" + endpoint + "] RC=" + e.reasonCode + ": " + e.getMessage(),
                Protocol.IBM_MQ, e);
        } finally {
            closeSilently(qMgr);
        }
    }
}
```

**MQ TLS:** Never configure in application.properties. Set as JVM args in `run.bat`:
```batch
-Djavax.net.ssl.keyStore=C:\paralleliq\certs\mq-client.jks
-Djavax.net.ssl.keyStorePassword=%MQ_KEYSTORE_PASS%
-Djavax.net.ssl.trustStore=C:\paralleliq\certs\mq-truststore.jks
-Djavax.net.ssl.trustStorePassword=%MQ_TRUSTSTORE_PASS%
-Dcom.ibm.mq.cfg.useIBMCipherMappings=false
```

**Preserve these MQMD fields on replay:**
`CorrelId`, `MsgId`, `Format`, `Persistence`, `ReplyToQueue`, `ReplyToQueueManager`

## Kafka Connector — key notes

- Use `KafkaConsumer` / `KafkaProducer` APIs directly (not `@KafkaListener` — capture is on-demand)
- Consumer group ID per run: `paralleliq-capture-{runId}` — prevents offset collision between runs
- Preserve all record headers and partition key on replay

```java
// Build consumer with SSL properties from application.properties
Properties props = new Properties();
props.put("bootstrap.servers", connProps.get("bootstrapServers"));
props.put("group.id", "paralleliq-capture-" + options.get("runId"));
props.put("security.protocol", kafkaProperties.getSecurityProtocol()); // from @ConfigurationProperties
props.put("ssl.keystore.location", kafkaProperties.getSslKeystoreLocation());
props.put("ssl.keystore.password", kafkaProperties.getSslKeystorePassword());
props.put("ssl.truststore.location", kafkaProperties.getSslTruststoreLocation());
props.put("ssl.truststore.password", kafkaProperties.getSslTruststorePassword());
```

## Solace Connector — key notes

```java
JCSMPProperties jcsmpProps = new JCSMPProperties();
jcsmpProps.setProperty(JCSMPProperties.HOST,     connProps.get("host"));
jcsmpProps.setProperty(JCSMPProperties.VPN_NAME, connProps.get("vpn"));
jcsmpProps.setProperty(JCSMPProperties.USERNAME, connProps.get("username"));
jcsmpProps.setProperty(JCSMPProperties.PASSWORD, connProps.get("password"));
// TLS:
jcsmpProps.setProperty(JCSMPProperties.SSL_TRUST_STORE,          solaceProps.getSslTrustStore());
jcsmpProps.setProperty(JCSMPProperties.SSL_TRUST_STORE_PASSWORD, solaceProps.getSslTrustStorePassword());
jcsmpProps.setProperty(JCSMPProperties.USE_SSL, true);
```

Preserve user properties and application message ID on replay.
Set `DeliveryMode.PERSISTENT` unless `options.get("fireAndForget")` is true.

## SFTP Connector — key notes

```java
// Use Apache Commons VFS2 + JSch
FileSystemOptions opts = new FileSystemOptions();
SftpFileSystemConfigBuilder builder = SftpFileSystemConfigBuilder.getInstance();
builder.setIdentities(opts,
    new File[]{new File(sftpProperties.getPrivateKeyPath())});
builder.setUserInfo(opts, new StaticUserInfo(sftpProperties.getPrivateKeyPassphrase()));
builder.setStrictHostKeyChecking(opts, "no"); // or "yes" with known_hosts file
```

For capture: list files matching glob pattern, read each, return one `CapturedMessage` per row/file.
For replay: write to target SFTP path with naming pattern from `options.get("fileNamingPattern")`.

## File Connector — key notes (local filesystem)

- Streaming CSV (OpenCSV) — one `CapturedMessage` per row, never load full file into memory
- Excel: use SAX-based streaming for files > 10MB (`XSSFSheetXMLHandler`)
- Never: `new XSSFWorkbook(file)` — loads entire file into heap

```java
// Streaming CSV — correct
try (CSVReader reader = new CSVReaderBuilder(new FileReader(path))
        .withSkipLines(1).build()) {
    String[] row;
    while ((row = reader.readNext()) != null) {
        messages.add(toMessage(row, headers));
    }
}
```

## Error handling in connectors — always

```java
} catch (SomeProtocolException e) {
    throw new ConnectorException(
        "Capture failed on [" + endpoint + "]: " + e.getMessage(),
        Protocol.KAFKA,   // or whichever protocol
        e
    );
}
```

`ConnectorException` is in `paralleliq-common`. Never swallow exceptions. Never return empty list silently on error.

## Resilience4j — wrap every capture() and replay() call

```java
// In application.properties:
// resilience4j.retry.instances.kafka.maxAttempts=3
// resilience4j.retry.instances.kafka.waitDuration=2s

@CircuitBreaker(name = "kafka", fallbackMethod = "captureFallback")
@Retry(name = "kafka")
public List<CapturedMessage> capture(...) { ... }

private List<CapturedMessage> captureFallback(String endpoint,
        Map<String,String> options, Map<String,String> connProps, Exception e) {
    throw new ConnectorException("Kafka unavailable after retries: " + e.getMessage(),
        Protocol.KAFKA, e);
}
```
