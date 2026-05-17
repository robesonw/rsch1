package com.paralleliq.agent.polling;

import com.paralleliq.common.dto.AgentDtos.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

/**
 * All HTTP communication from the agent to the paralleliq-api.
 *
 * Uses RestTemplate (Spring Boot 2.7 / Java 8 compatible).
 * All calls are outbound HTTPS — the agent never accepts inbound connections.
 *
 * Authentication: X-Agent-Key header (configured in application.properties).
 * This is separate from the JWT used by the UI — agents use a simpler shared key.
 */
@Component
@Slf4j
public class ApiClient {

    private final RestTemplate restTemplate;
    private final String apiBaseUrl;
    private final String agentKey;

    public ApiClient(
            RestTemplate restTemplate,
            @Value("${paralleliq.api.base-url}") String apiBaseUrl,
            @Value("${paralleliq.api.agent-key}") String agentKey) {
        this.restTemplate = restTemplate;
        this.apiBaseUrl = apiBaseUrl;
        this.agentKey = agentKey;
    }

    public void register(AgentRegistration registration) {
        try {
            restTemplate.exchange(
                apiBaseUrl + "/api/v1/agent/register",
                HttpMethod.POST,
                new HttpEntity<>(registration, authHeaders()),
                new ParameterizedTypeReference<ApiResponse<Void>>() {}
            );
        } catch (Exception e) {
            log.warn("Registration failed: {}", e.getMessage());
        }
    }

    /**
     * Polls for the next queued run.
     * Returns null if nothing is queued — agent should stop and exit.
     */
    public RunAssignment pollForNextRun(String agentId) {
        try {
            HttpHeaders headers = authHeaders();
            headers.set("X-Agent-Id", agentId);

            ResponseEntity<ApiResponse<RunAssignment>> response = restTemplate.exchange(
                apiBaseUrl + "/api/v1/agent/runs/next",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<ApiResponse<RunAssignment>>() {}
            );

            if (response.getBody() != null && response.getBody().getData() != null) {
                return response.getBody().getData();
            }
            return null;

        } catch (HttpClientErrorException.NotFound e) {
            return null; // no work — normal case
        } catch (Exception e) {
            log.error("Failed to poll for runs: {}", e.getMessage());
            return null;
        }
    }

    public void postProgress(String runId, ProgressUpdate update) {
        try {
            restTemplate.exchange(
                apiBaseUrl + "/api/v1/agent/runs/" + runId + "/progress",
                HttpMethod.POST,
                new HttpEntity<>(update, authHeaders()),
                new ParameterizedTypeReference<ApiResponse<Void>>() {}
            );
        } catch (Exception e) {
            // Progress posting failure is non-fatal — log and continue execution
            log.warn("Could not post progress for run {}: {}", runId, e.getMessage());
        }
    }

    public void postResults(String runId, RunResultPayload results) {
        try {
            restTemplate.exchange(
                apiBaseUrl + "/api/v1/agent/runs/" + runId + "/results",
                HttpMethod.POST,
                new HttpEntity<>(results, authHeaders()),
                new ParameterizedTypeReference<ApiResponse<Void>>() {}
            );
            log.info("Results posted for run {}", runId);
        } catch (Exception e) {
            log.error("Failed to post results for run {}: {}", runId, e.getMessage());
            throw new RuntimeException("Could not post results to API — run " + runId, e);
        }
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Agent-Key", agentKey);
        return headers;
    }
}
