package com.paralleliq.api.controller;

import com.paralleliq.common.dto.AgentDtos.AgentRegistration;
import com.paralleliq.common.dto.AgentDtos.ApiResponse;
import com.paralleliq.common.dto.AgentDtos.ProgressUpdate;
import com.paralleliq.common.dto.AgentDtos.RunAssignment;
import com.paralleliq.common.dto.AgentDtos.RunResultPayload;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Endpoints called exclusively by the paralleliq-agent.
 * The agent polls /next to claim work, posts /progress during execution,
 * and posts /results when complete.
 *
 * These endpoints are secured with an agent API key (header: X-Agent-Key)
 * configured in application.properties — not JWT, so no browser login needed.
 */
@RestController
@RequestMapping("/api/v1/agent")
@Tag(name = "Agent", description = "Agent communication endpoints — not for UI use")
@RequiredArgsConstructor
@Slf4j
public class AgentController {

    // TODO: inject AgentService when implementing M1-E6

    @PostMapping("/register")
    @Operation(summary = "Agent registers itself on startup — records capabilities and hostname")
    public ResponseEntity<ApiResponse<Void>> register(@RequestBody AgentRegistration registration) {
        log.info("Agent registered: id={} host={} protocols={}",
            registration.getAgentId(),
            registration.getHostname(),
            registration.getSupportedProtocols());
        // TODO: persist to agent_registrations table
        return ResponseEntity.ok(ApiResponse.<Void>builder().success(true).build());
    }

    @GetMapping("/runs/next")
    @Operation(summary = "Agent polls for next queued run — returns empty if nothing queued")
    public ResponseEntity<ApiResponse<RunAssignment>> nextRun(
            @RequestHeader("X-Agent-Id") String agentId) {
        log.debug("Agent {} polling for work", agentId);
        // TODO: query runs table for oldest QUEUED run, mark as PICKED_UP, return assignment
        // Return empty data (not 404) when nothing is queued — agent treats null data as "nothing to do"
        return ResponseEntity.ok(ApiResponse.<RunAssignment>builder().success(true).data(null).build());
    }

    @PostMapping("/runs/{runId}/progress")
    @Operation(summary = "Agent posts step-level progress during execution")
    public ResponseEntity<ApiResponse<Void>> postProgress(
            @PathVariable String runId,
            @RequestBody ProgressUpdate update) {
        log.info("Run {} progress: step={} status={} pct={}",
            runId, update.getStepType(), update.getStatus(), update.getProgressPct());
        // TODO: update run_steps table, broadcast to WebSocket subscribers
        return ResponseEntity.ok(ApiResponse.<Void>builder().success(true).build());
    }

    @PostMapping("/runs/{runId}/results")
    @Operation(summary = "Agent posts final run results on completion")
    public ResponseEntity<ApiResponse<Void>> postResults(
            @PathVariable String runId,
            @RequestBody RunResultPayload results) {
        log.info("Run {} completed: status={} matched={}/{}",
            runId, results.getStatus(), results.getMatchedRecords(), results.getTotalRecords());
        // TODO: bulk insert field results, update run status, trigger alerts if threshold breached
        return ResponseEntity.ok(ApiResponse.<Void>builder().success(true).build());
    }
}
