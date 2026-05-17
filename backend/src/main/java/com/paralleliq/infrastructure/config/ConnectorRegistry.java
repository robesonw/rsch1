package com.paralleliq.infrastructure.config;

import com.paralleliq.domain.model.Protocol;
import com.paralleliq.domain.model.exception.ConnectorException;
import com.paralleliq.domain.port.ConnectorPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Discovers all ConnectorPort implementations in the Spring context.
 * To add a new protocol: implement ConnectorPort — Spring registers it automatically.
 */
@Component
@RequiredArgsConstructor
public class ConnectorRegistry {

    private final List<ConnectorPort> connectors;

    public ConnectorPort forProtocol(Protocol protocol) {
        return connectors.stream()
            .filter(c -> c.supports() == protocol)
            .findFirst()
            .orElseThrow(() -> new ConnectorException(
                "No connector registered for protocol: " + protocol, protocol));
    }
}
