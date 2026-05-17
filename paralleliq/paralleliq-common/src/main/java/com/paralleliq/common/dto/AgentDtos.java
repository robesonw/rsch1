package com.paralleliq.common.dto;

import com.paralleliq.common.model.ExecutionMode;
import com.paralleliq.common.model.Protocol;
import com.paralleliq.common.model.RunStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * DTOs shared between paralleliq-api and paralleliq-agent.
 * Both modules depend on paralleliq-common — do not duplicate these classes.
 *
 * Java 8 style: @Data + @Builder + @NoArgsConstructor + @AllArgsConstructor
 * (replaces Java 14+ records)
 */
public final class AgentDtos {

    private AgentDtos() {}

    // ── What the agent receives when it polls for work ────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RunAssignment {
        private String runId;
        private String parallelName;
        private ExecutionMode executionMode;
        private SourceBindingDto sourceBinding;
        private TargetBindingDto targetBinding;
        private String ruleSetDefinition;      // JSON string of the rule set
        private String assertionSetDefinition; // JSON string of the assertion set
        private String inlineOverrides;        // JSON patch, may be null
        private OutputPullDto outputPull;
        private Map<String, String> params;    // runtime params e.g. {batchDate: "2026-05-01"}
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SourceBindingDto {
        private String environmentId;
        private String environmentName;
        private Protocol protocol;
        private String endpoint;               // queue name, topic, file path, table
        private String filter;                 // optional filter expression
        private String captureMode;            // SNAPSHOT_DURATION | SNAPSHOT_COUNT | CONTINUOUS
        private Integer durationSeconds;
        private Integer maxMessages;
        private String correlationKey;         // field/header to use as correlation key
        private Map<String, String> connectionProperties; // resolved at API side — host, port etc.
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TargetBindingDto {
        private String environmentId;
        private String environmentName;
        private Protocol protocol;
        private String endpoint;
        private Integer ratePerSecond;         // 0 = no limit
        private boolean preserveOrder;
        private Map<String, String> connectionProperties;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OutputPullDto {
        private String type;                   // DB_QUERY | FILE
        private String query;                  // parameterised SQL, may be null
        private String filePath;               // file or SFTP path, may be null
    }

    // ── What the agent posts back during and after execution ─────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProgressUpdate {
        private String runId;
        private String stepType;               // CAPTURE | TRANSFORM | REPLAY | COMPARE
        private RunStatus status;
        private String message;
        private Integer progressPct;
        private Instant timestamp;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RunResultPayload {
        private String runId;
        private RunStatus status;
        private Integer totalRecords;
        private Integer matchedRecords;
        private String errorMessage;
        private List<FieldResultDto> fieldResults;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldResultDto {
        private String recordKey;
        private String fieldName;
        private String expectedValue;
        private String actualValue;
        private boolean matched;
        private String mismatchReason;
        private String environmentRole;        // ENV_A | ENV_B
    }

    // ── Agent registration ────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AgentRegistration {
        private String agentId;                // e.g. "WIN-SERVER-01"
        private String hostname;
        private List<Protocol> supportedProtocols;
        private String version;
    }

    // ── Standard API response envelope ───────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ApiResponse<T> {
        private boolean success;
        private T data;
        private String error;
        private String code;
    }
}
