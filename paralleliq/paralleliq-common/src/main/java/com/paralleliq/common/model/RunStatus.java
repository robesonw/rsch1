package com.paralleliq.common.model;

public enum RunStatus {
    QUEUED,
    PICKED_UP,   // agent has claimed this run
    RUNNING,
    PASSED,
    FAILED,
    CANCELLED
}
