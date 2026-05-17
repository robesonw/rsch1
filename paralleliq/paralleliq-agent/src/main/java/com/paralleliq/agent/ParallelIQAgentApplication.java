package com.paralleliq.agent;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * ParallelIQ Agent — executable JAR for Windows Server.
 *
 * Designed for Windows Task Scheduler:
 *   Starts → registers with API → polls for queued runs → executes all of them → exits.
 *
 * Run command (Task Scheduler Action):
 *   java -jar C:\paralleliq\paralleliq-agent.jar
 *
 * Optional JVM args for certificates (add to Task Scheduler action):
 *   -Djavax.net.ssl.keyStore=C:\paralleliq\certs\client.jks
 *   -Djavax.net.ssl.keyStorePassword=changeit
 *   -Djavax.net.ssl.trustStore=C:\paralleliq\certs\truststore.jks
 *   -Djavax.net.ssl.trustStorePassword=changeit
 *
 * Config file (application.properties must be in same folder as JAR, or use --spring.config.location):
 *   java -jar paralleliq-agent.jar --spring.config.location=C:\paralleliq\config\
 *
 * Exclude DB autoconfiguration — agent does not have its own database.
 * It talks to the API via REST only.
 */
@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
@Slf4j
public class ParallelIQAgentApplication implements ApplicationRunner {

    private final AgentOrchestrator orchestrator;
    private final ConfigurableApplicationContext context;

    public ParallelIQAgentApplication(AgentOrchestrator orchestrator,
                                       ConfigurableApplicationContext context) {
        this.orchestrator = orchestrator;
        this.context = context;
    }

    public static void main(String[] args) {
        // SpringApplication.exit ensures the JVM exits after run() completes
        // This is critical for Task Scheduler — the task must not hang open
        ConfigurableApplicationContext ctx = SpringApplication.run(
            ParallelIQAgentApplication.class, args);
        int exitCode = SpringApplication.exit(ctx, () -> 0);
        System.exit(exitCode);
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("=== ParallelIQ Agent starting ===");
        try {
            orchestrator.registerWithApi();
            orchestrator.executeAllQueuedRuns();
            log.info("=== ParallelIQ Agent finished — all queued runs processed ===");
        } catch (Exception e) {
            log.error("Agent execution failed", e);
            // Exit code 1 — Task Scheduler can be configured to alert on non-zero exit
            System.exit(1);
        }
    }
}
