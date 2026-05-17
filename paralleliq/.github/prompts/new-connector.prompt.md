# Add a New Protocol Connector

## What to build

A new messaging/file/database connector in `paralleliq-agent`.

### 1. Add to Protocol enum
File: `paralleliq-common/src/main/java/com/paralleliq/common/model/Protocol.java`
Add the new enum value (e.g. `RABBITMQ`, `ACTIVEMQ`).

### 2. Create the connector class
File: `paralleliq-agent/src/main/java/com/paralleliq/agent/connector/{protocol}/{Name}Connector.java`

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class {Name}Connector implements ConnectorPort {

    @Override
    public Protocol supports() { return Protocol.{NAME}; }

    @Override
    public List<CapturedMessage> capture(String endpoint,
                                          Map<String, String> options,
                                          Map<String, String> connProps) {
        // connProps: host, port, username, password + protocol-specific fields
        // options:   captureMode, durationSeconds, maxMessages, correlationKey, filter
        try {
            // ... implementation
        } catch (SomeProtocolException e) {
            throw new ConnectorException(
                "Capture failed on [" + endpoint + "]: " + e.getMessage(),
                Protocol.{NAME}, e);
        }
    }

    @Override
    public void replay(List<TransformedMessage> messages, String endpoint,
                       Map<String, String> options, Map<String, String> connProps) {
        // ... implementation
        // Emit metric: meterRegistry.timer("paralleliq.connector.replay.duration", "protocol", "...")
    }
}
```

Spring auto-discovers the connector via `ConnectorRegistry` — no manual registration needed.

### 3. Configuration properties class
File: `paralleliq-agent/src/main/java/com/paralleliq/agent/config/{Name}Properties.java`

```java
@ConfigurationProperties(prefix = "paralleliq.connector.{protocol-lowercase}")
@Data
public class {Name}Properties {
    private String securityProtocol;
    private String sslKeystoreLocation;
    private String sslKeystorePassword;
    // ... other config
}
```

### 4. Add to agent application.properties
```properties
# {Protocol name} connector
# paralleliq.connector.{protocol}.ssl.keystore.location=C:\\paralleliq\\certs\\{protocol}.jks
# paralleliq.connector.{protocol}.ssl.keystore.password=${KEYSTORE_PASS}
```
Add commented-out defaults — operator uncomments what they need.

### 5. Add Maven dependency to paralleliq-agent/pom.xml
```xml
<dependency>
    <groupId>...</groupId>
    <artifactId>...</artifactId>
    <version>...</version>
</dependency>
```

### 6. Unit tests
File: `paralleliq-agent/src/test/java/com/paralleliq/agent/connector/{protocol}/{Name}ConnectorTest.java`

Test:
- `capture()` returns correctly mapped `CapturedMessage` list
- `capture()` wraps protocol exceptions as `ConnectorException`
- `replay()` calls the protocol client with correct arguments
- `replay()` wraps protocol exceptions as `ConnectorException`

### 7. Update Windows setup guide
Add certificate setup section to `paralleliq-agent/WINDOWS-SETUP.md`.

### 8. Update agent registration
The agent's supported protocols list in `AgentOrchestrator.getSupportedProtocols()` should be updated to include the new protocol.

## Inputs needed

- Protocol name (e.g. `RABBITMQ`)
- Maven dependency coordinates
- Key connection properties (host, port, virtualhost, credentials pattern)
- Header/metadata fields to preserve in `CapturedMessage.headers`
- Certificate/TLS requirements
