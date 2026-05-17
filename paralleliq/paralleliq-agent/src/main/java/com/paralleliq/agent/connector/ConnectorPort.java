package com.paralleliq.agent.connector;

import com.paralleliq.common.model.Protocol;

import java.util.List;
import java.util.Map;

/**
 * Every protocol connector implements this interface.
 * The RunExecutor calls only this interface — never implementations directly.
 *
 * Adding a new protocol:
 *   1. Add enum value to Protocol in paralleliq-common
 *   2. Create {Protocol}Connector implementing this interface
 *   3. Spring auto-discovers it via ConnectorRegistry
 *   4. Add connector config to application.properties
 *   5. Add any required certificates/keystores to the server
 */
public interface ConnectorPort {

    /** Protocol this connector handles */
    Protocol supports();

    /**
     * Capture messages/records from a source endpoint.
     * Blocks until duration or count is satisfied.
     *
     * @param endpoint     queue name, topic, file path, table name
     * @param options      captureMode, duration, maxMessages, correlationKey, filter
     * @param connProps    resolved connection properties from the Environment config
     * @return             list of captured messages, one per record/message
     */
    List<CapturedMessage> capture(String endpoint,
                                   Map<String, String> options,
                                   Map<String, String> connProps);

    /**
     * Replay transformed messages to a target endpoint.
     *
     * @param messages     transformed messages to send
     * @param endpoint     target queue, topic, file path, or table
     * @param options      ratePerSecond, preserveOrder
     * @param connProps    resolved connection properties from the Environment config
     */
    void replay(List<TransformedMessage> messages,
                String endpoint,
                Map<String, String> options,
                Map<String, String> connProps);

    // ── Value objects ─────────────────────────────────────────────

    /**
     * A single message or record captured from a source.
     * Java 8 style — no records.
     */
    class CapturedMessage {
        private final String correlationKey;
        private final byte[] payload;
        private final Map<String, String> headers;
        private final long capturedAtEpochMs;

        public CapturedMessage(String correlationKey, byte[] payload,
                               Map<String, String> headers, long capturedAtEpochMs) {
            this.correlationKey = correlationKey;
            this.payload = payload;
            this.headers = headers;
            this.capturedAtEpochMs = capturedAtEpochMs;
        }

        public String getCorrelationKey() { return correlationKey; }
        public byte[] getPayload() { return payload; }
        public Map<String, String> getHeaders() { return headers; }
        public long getCapturedAtEpochMs() { return capturedAtEpochMs; }
    }

    /**
     * A message after transformation rules have been applied.
     */
    class TransformedMessage {
        private final String correlationKey;
        private final byte[] payload;
        private final Map<String, String> headers;

        public TransformedMessage(String correlationKey, byte[] payload,
                                  Map<String, String> headers) {
            this.correlationKey = correlationKey;
            this.payload = payload;
            this.headers = headers;
        }

        public String getCorrelationKey() { return correlationKey; }
        public byte[] getPayload() { return payload; }
        public Map<String, String> getHeaders() { return headers; }
    }
}
