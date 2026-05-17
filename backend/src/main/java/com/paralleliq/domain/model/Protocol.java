package com.paralleliq.domain.model;

/**
 * All supported source/target protocols.
 * Adding a new protocol: add enum value here, then implement ConnectorPort.
 */
public enum Protocol {
    IBM_MQ,
    KAFKA,
    SOLACE,
    SFTP,
    FILE,
    DATABASE
}
