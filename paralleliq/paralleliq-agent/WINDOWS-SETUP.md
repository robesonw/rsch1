# ParallelIQ Agent — Windows Task Scheduler Setup

## What the agent does when Task Scheduler runs it

1. Starts the JVM
2. Registers with the API (tells it the agent is alive)
3. Polls the API for queued runs
4. Executes each run: capture → transform → replay → compare
5. Posts results back to the API
6. Exits (JVM shuts down cleanly)

Task Scheduler sees a clean exit (code 0 = success, code 1 = error).

---

## Folder structure on the Windows Server

```
C:\paralleliq\
├── paralleliq-agent.jar          ← the executable JAR (copy here after build)
├── config\
│   └── application.properties   ← your config (not bundled in JAR — easier to update)
├── certs\
│   ├── mq-client.jks             ← IBM MQ client keystore
│   ├── mq-truststore.jks         ← IBM MQ truststore
│   ├── kafka-client.jks          ← Kafka keystore (if mTLS)
│   ├── kafka-truststore.jks      ← Kafka truststore
│   ├── solace-truststore.jks     ← Solace truststore
│   └── sftp-id_rsa               ← SFTP private key
└── logs\
    └── agent.log                 ← rolling log file
```

---

## Task Scheduler action — run.bat

Create `C:\paralleliq\run.bat`:

```batch
@echo off

REM ── Environment variables (keep passwords out of Task Scheduler UI) ──
set AGENT_KEY=your-agent-key-here
set SFTP_KEY_PASS=your-sftp-passphrase
set KAFKA_KEYSTORE_PASS=your-kafka-keystore-pass
set KAFKA_TRUSTSTORE_PASS=your-kafka-truststore-pass
set MQ_KEYSTORE_PASS=your-mq-keystore-pass
set MQ_TRUSTSTORE_PASS=your-mq-truststore-pass

REM ── JVM certificate arguments ────────────────────────────────────────
set JVM_CERT_ARGS=
set JVM_CERT_ARGS=%JVM_CERT_ARGS% -Djavax.net.ssl.keyStore=C:\paralleliq\certs\mq-client.jks
set JVM_CERT_ARGS=%JVM_CERT_ARGS% -Djavax.net.ssl.keyStorePassword=%MQ_KEYSTORE_PASS%
set JVM_CERT_ARGS=%JVM_CERT_ARGS% -Djavax.net.ssl.trustStore=C:\paralleliq\certs\mq-truststore.jks
set JVM_CERT_ARGS=%JVM_CERT_ARGS% -Djavax.net.ssl.trustStorePassword=%MQ_TRUSTSTORE_PASS%
set JVM_CERT_ARGS=%JVM_CERT_ARGS% -Dcom.ibm.mq.cfg.useIBMCipherMappings=false

REM ── Run the agent ────────────────────────────────────────────────────
java %JVM_CERT_ARGS% ^
  -Xmx512m ^
  -jar C:\paralleliq\paralleliq-agent.jar ^
  --spring.config.location=C:\paralleliq\config\

REM ── Capture exit code ────────────────────────────────────────────────
exit /b %ERRORLEVEL%
```

**Important:** Do not commit `run.bat` to Git — it contains passwords. Keep it on the server only.
Better still: use Windows Credential Manager or encrypted environment variables.

---

## Task Scheduler configuration

1. Open **Task Scheduler** → Create Task (not Basic Task)

2. **General tab:**
   - Name: `ParallelIQ Agent`
   - Run whether user is logged on or not: ✓
   - Run with highest privileges: ✓
   - Configure for: Windows Server 2016/2019

3. **Triggers tab → New:**
   - Begin the task: On a schedule
   - Daily, repeat every: **5 minutes** (or your preferred polling interval)
   - Duration: Indefinitely
   - Stop task if it runs longer than: **1 hour** (safety net)

4. **Actions tab → New:**
   - Action: Start a program
   - Program/script: `C:\paralleliq\run.bat`
   - Start in: `C:\paralleliq\`

5. **Settings tab:**
   - If the task is already running → Do not start a new instance
     (prevents overlapping runs if a previous execution is slow)
   - Stop the task if it runs longer than: 1 hour

6. **Conditions tab:**
   - Uncheck "Start only if on AC power" if on a server

---

## Verifying it works

After the first scheduled run, check:

```
C:\paralleliq\logs\agent.log
```

Expected log output for a successful cycle:
```
10:00:01 INFO  AgentOrchestrator [     ] - Registered with API as agent 'WIN-SERVER-01'
10:00:01 INFO  AgentOrchestrator [     ] - Polling for queued runs...
10:00:02 INFO  AgentOrchestrator [run-abc123] - Claimed run run-abc123 (parallel: Policy Renewal Q3)
10:00:02 INFO  RunExecutor       [run-abc123] - Starting CAPTURE step
10:00:08 INFO  RunExecutor       [run-abc123] - Captured 1240 messages
10:00:08 INFO  RunExecutor       [run-abc123] - Starting TRANSFORM step
...
10:00:12 INFO  AgentOrchestrator [     ] - No queued runs — agent done. Executed 1 run(s) this cycle.
```

---

## Updating the agent

1. Build new JAR: `cd paralleliq-agent && mvn clean package`
2. Copy `target\paralleliq-agent-1.0.0-SNAPSHOT.jar` to `C:\paralleliq\paralleliq-agent.jar`
3. The next Task Scheduler execution picks up the new JAR automatically
4. No Windows Service restart needed — Task Scheduler launches a fresh JVM each time

---

## Adding certificates

When connecting to a new environment that uses a different CA:

```batch
REM Import CA cert into JVM truststore (run once as Administrator)
keytool -import -trustcacerts ^
  -alias new-env-ca ^
  -file C:\paralleliq\certs\new-env-ca.cer ^
  -keystore "C:\Program Files\Java\jre\lib\security\cacerts" ^
  -storepass changeit
```

No agent restart or redeployment needed — takes effect on next execution.
