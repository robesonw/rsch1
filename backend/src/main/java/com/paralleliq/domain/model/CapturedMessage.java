package com.paralleliq.domain.model;

import java.time.Instant;
import java.util.Map;

/**
 * A single message captured from Env A.
 * Immutable value object — no framework dependencies.
 */
public record CapturedMessage(
    String correlationKey,
    byte[] payload,
    Map<String, String> headers,
    Instant capturedAt,
    Protocol protocol,
    String sourceEndpoint
) {}
