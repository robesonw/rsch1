package com.paralleliq.domain.model.exception;

import com.paralleliq.domain.model.Protocol;

public class ConnectorException extends RuntimeException {

    private final Protocol protocol;

    public ConnectorException(String message, Protocol protocol) {
        super(message);
        this.protocol = protocol;
    }

    public ConnectorException(String message, Throwable cause, Protocol protocol) {
        super(message, cause);
        this.protocol = protocol;
    }

    public Protocol getProtocol() { return protocol; }
}
