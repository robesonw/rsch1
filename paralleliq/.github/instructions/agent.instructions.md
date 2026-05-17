---
applyTo: "paralleliq-agent/src/**/*.java"
---

# Agent Instructions

## What the agent is

A standalone executable JAR that runs on a Windows Server via Task Scheduler.
It starts, does all queued work, then exits. It has no web server, no UI, no database of its own.

## Execution flow — always this order

```
main() → AgentOrchestrator.registerWithApi()
       → AgentOrchestrator.executeAllQueuedRuns()
             └── while (assignment = apiClient.pollForNextRun()) != null:
                     RunExecutor.execute(assignment)
                       ├── CaptureStep
                       ├── TransformStep
                       ├── ReplayStep
                       └── CompareStep
       → System.exit(0)
```

## Certificate handling — the agent's most important concern

All certificate configuration goes in `application.properties` (on the Windows Server, not in the JAR).
Passwords always from environment variables — never hardcoded.

### IBM MQ TLS
Set as JVM arguments in the Task Scheduler batch file (run.bat):
```batch
-Djavax.net.ssl.keyStore=C:\paralleliq\certs\mq-client.jks
-Djavax.net.ssl.keyStorePassword=%MQ_KEYSTORE_PASS%
-Djavax.net.ssl.trustStore=C:\paralleliq\certs\mq-truststore.jks
-Djavax.net.ssl.trustStorePassword=%MQ_TRUSTSTORE_PASS%
-Dcom.ibm.mq.cfg.useIBMCipherMappings=false
```

### Kafka mTLS
```properties
paralleliq.connector.kafka.ssl.keystore.location=C:\\paralleliq\\certs\\kafka.jks
paralleliq.connector.kafka.ssl.keystore.password=${KAFKA_KEYSTORE_PASS}
paralleliq.connector.kafka.ssl.truststore.location=C:\\paralleliq\\certs\\kafka-truststore.jks
paralleliq.connector.kafka.ssl.truststore.password=${KAFKA_TRUSTSTORE_PASS}
paralleliq.connector.kafka.security.protocol=SSL
```

### Building a Kafka producer/consumer with SSL from properties
```java
Properties props = new Properties();
props.put("bootstrap.servers", connProps.get("bootstrapServers"));
props.put("security.protocol", kafkaProperties.getSecurityProtocol());
props.put("ssl.keystore.location", kafkaProperties.getSslKeystoreLocation());
props.put("ssl.keystore.password", kafkaProperties.getSslKeystorePassword());
props.put("ssl.truststore.location", kafkaProperties.getSslTruststoreLocation());
props.put("ssl.truststore.password", kafkaProperties.getSslTruststorePassword());
```

### Solace TLS
```java
JCSMPProperties jcsmpProps = new JCSMPProperties();
jcsmpProps.setProperty(JCSMPProperties.HOST, connProps.get("host"));
jcsmpProps.setProperty(JCSMPProperties.SSL_TRUST_STORE, solaceProperties.getSslTrustStore());
jcsmpProps.setProperty(JCSMPProperties.SSL_TRUST_STORE_PASSWORD, solaceProperties.getSslTrustStorePassword());
jcsmpProps.setProperty(JCSMPProperties.USE_SSL, true);
```

## ConnectorPort — always implement this

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class IbmMqConnector implements ConnectorPort {

    @Override
    public Protocol supports() {
        return Protocol.IBM_MQ;
    }

    @Override
    public List<CapturedMessage> capture(String endpoint,
                                          Map<String, String> options,
                                          Map<String, String> connProps) {
        // connProps contains: host, port, queueManager, channel, username, password
        // options contains: captureMode, durationSeconds, maxMessages, correlationKey, filter
        try {
            // ... implementation
        } catch (MQException e) {
            throw new ConnectorException(
                "MQ capture failed on " + endpoint + ": " + e.getMessage() + " (RC=" + e.reasonCode + ")",
                Protocol.IBM_MQ, e);
        }
    }

    @Override
    public void replay(List<TransformedMessage> messages, String endpoint,
                       Map<String, String> options, Map<String, String> connProps) {
        // ...
    }
}
```

## Progress reporting during execution

Post progress at each step boundary:
```java
apiClient.postProgress(runId, ProgressUpdate.builder()
    .runId(runId)
    .stepType("CAPTURE")
    .status(RunStatus.RUNNING)
    .message("Capturing from " + endpoint)
    .progressPct(0)
    .timestamp(Instant.now())
    .build());
```

## Logging — always use MDC

```java
MDC.put("runId", assignment.getRunId());
try {
    log.info("Starting execution for parallel '{}'", assignment.getParallelName());
    // ... all subsequent log lines carry runId automatically
} finally {
    MDC.clear();
}
```

Log file is at `C:\paralleliq\logs\agent.log` — configured in `application.properties`.
Task Scheduler does not capture stdout reliably — always log to file.

## Exit codes

- `System.exit(0)` — all queued runs processed (success or failed runs are still exit 0)
- `System.exit(1)` — unrecoverable agent error (API unreachable, etc.)

Task Scheduler can be configured to send an alert on non-zero exit codes.
