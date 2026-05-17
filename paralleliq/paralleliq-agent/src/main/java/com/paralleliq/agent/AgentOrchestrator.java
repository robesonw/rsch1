package com.paralleliq.agent;

import com.paralleliq.agent.polling.ApiClient;
import com.paralleliq.agent.execution.RunExecutor;
import com.paralleliq.common.dto.AgentDtos.AgentRegistration;
import com.paralleliq.common.dto.AgentDtos.RunAssignment;
import com.paralleliq.common.model.Protocol;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.Arrays;
import java.util.List;

/**
 * Orchestrates a single agent execution cycle:
 *   1. Register with the API (tells the API this agent is alive and what it can do)
 *   2. Poll for queued runs — repeat until no more work
 *   3. Execute each run via RunExecutor
 *   4. Return — JVM exits, Task Scheduler marks the task complete
 *
 * The agent is stateless between executions. All state lives in the API's database.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AgentOrchestrator {

    private final ApiClient apiClient;
    private final RunExecutor runExecutor;

    @Value("${paralleliq.agent.id:#{T(java.net.InetAddress).getLocalHost().getHostName()}}")
    private String agentId;

    @Value("${paralleliq.agent.version:1.0.0}")
    private String agentVersion;

    /**
     * Registers this agent instance with the API on startup.
     * The API uses this to know which agents are available and what protocols they support.
     */
    public void registerWithApi() {
        try {
            String hostname = InetAddress.getLocalHost().getHostName();
            AgentRegistration registration = AgentRegistration.builder()
                .agentId(agentId)
                .hostname(hostname)
                .supportedProtocols(getSupportedProtocols())
                .version(agentVersion)
                .build();

            apiClient.register(registration);
            log.info("Registered with API as agent '{}' on host '{}'", agentId, hostname);
        } catch (Exception e) {
            // Registration failure is non-fatal — log and continue
            log.warn("Could not register with API: {} — continuing with execution", e.getMessage());
        }
    }

    /**
     * Polls the API for queued runs and executes them one at a time until the queue is empty.
     * Task Scheduler calls this once per schedule interval.
     */
    public void executeAllQueuedRuns() {
        int executed = 0;

        while (true) {
            RunAssignment assignment = apiClient.pollForNextRun(agentId);

            if (assignment == null) {
                log.info("No queued runs — agent done. Executed {} run(s) this cycle.", executed);
                return;
            }

            log.info("Claimed run {} (parallel: {})", assignment.getRunId(), assignment.getParallelName());
            runExecutor.execute(assignment);
            executed++;
        }
    }

    /**
     * Returns the list of protocols this agent supports.
     * Driven by which connector beans are present in the Spring context.
     * Add or remove protocols here when deploying to different server environments.
     */
    private List<Protocol> getSupportedProtocols() {
        // TODO: make this dynamic — detect which connector beans are actually configured
        return Arrays.asList(
            Protocol.IBM_MQ,
            Protocol.KAFKA,
            Protocol.SOLACE,
            Protocol.SFTP,
            Protocol.FILE,
            Protocol.DATABASE
        );
    }
}
