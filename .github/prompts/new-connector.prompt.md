# Add a New Protocol Connector

## Task

Add a new messaging/file protocol connector to ParallelIQ.

## What to build

1. **Connector class** at `backend/src/main/java/com/paralleliq/infrastructure/connector/{protocol}/{ProtocolName}Connector.java`
   - Implements `ConnectorPort`
   - Annotated with `@Component` and `@RequiredArgsConstructor`
   - `supports()` returns the correct `Protocol` enum value
   - `capture()` connects to the source, reads messages, returns `List<CapturedMessage>`
   - `replay()` connects to the target, dispatches `List<TransformedMessage>`
   - All protocol exceptions wrapped in `ConnectorException`

2. **Add to `Protocol` enum** at `backend/src/main/java/com/paralleliq/domain/model/Protocol.java` if not already present

3. **Configuration properties class** at `infrastructure/connector/{protocol}/{ProtocolName}Properties.java`
   - `@ConfigurationProperties(prefix = "paralleliq.connector.{protocol}")`
   - Contains defaults, timeouts, retry config

4. **Unit test** at `backend/src/test/java/com/paralleliq/infrastructure/connector/{protocol}/{ProtocolName}ConnectorTest.java`
   - Mock the protocol client
   - Test capture returns correctly mapped `CapturedMessage` list
   - Test replay calls the client with correct arguments
   - Test that protocol exceptions are wrapped as `ConnectorException`

5. **Flyway migration** — only if new config columns are needed in `environments` table

6. **Update `application.yml`** with commented-out sample config block for the new connector

7. **Update `docs/connector-interface.md`** with a section for the new protocol

## Inputs needed

- Protocol name (e.g. `ACTIVEMQ`, `RABBITMQ`, `REST_WEBHOOK`)
- Maven dependency to add to `pom.xml`
- Key protocol-specific config properties (host, port, credentials pattern)
- Any special header/metadata fields to preserve in `CapturedMessage.headers`
