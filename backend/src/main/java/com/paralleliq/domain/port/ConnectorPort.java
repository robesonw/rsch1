package com.paralleliq.domain.port;

import com.paralleliq.domain.model.CapturedMessage;
import com.paralleliq.domain.model.Protocol;
import com.paralleliq.domain.model.SourceBinding;
import com.paralleliq.domain.model.TargetBinding;
import com.paralleliq.domain.model.TransformedMessage;

import java.util.List;

/**
 * Implemented by each protocol connector in infrastructure/connector/.
 * The execution engine calls only this interface — never the implementations directly.
 *
 * To add a new protocol:
 *   1. Add enum value to Protocol
 *   2. Create {Protocol}Connector implementing this interface in infrastructure/connector/{protocol}/
 *   3. Spring will auto-register it via ConnectorRegistry
 */
public interface ConnectorPort {

    /** Which protocol this connector handles. */
    Protocol supports();

    /**
     * Capture messages from Env A according to the source binding.
     * Blocks until the capture duration or message count is satisfied.
     *
     * @throws com.paralleliq.domain.model.exception.ConnectorException on protocol error
     */
    List<CapturedMessage> capture(SourceBinding binding, CaptureOptions options);

    /**
     * Replay transformed messages to Env B according to the target binding.
     *
     * @throws com.paralleliq.domain.model.exception.ConnectorException on protocol error
     */
    void replay(List<TransformedMessage> messages, TargetBinding binding, ReplayOptions options);

    record CaptureOptions(
        java.time.Duration duration,
        Integer maxMessages,
        boolean fromBeginning
    ) {
        public static CaptureOptions withDuration(java.time.Duration duration) {
            return new CaptureOptions(duration, null, false);
        }
        public static CaptureOptions withCount(int count) {
            return new CaptureOptions(null, count, false);
        }
    }

    record ReplayOptions(
        int ratePerSecond,
        boolean preserveOrder,
        boolean fireAndForget,
        String dmqEndpoint
    ) {
        public static ReplayOptions defaults() {
            return new ReplayOptions(0, true, false, null);
        }
    }
}
