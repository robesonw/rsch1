package com.paralleliq.common.model;

/**
 * Mode 1 — REPLAY_VALIDATE: capture Env A, replay to Env B, compare.
 * Mode 2 — TRUE_PARALLEL:   inject same data to both envs, capture both, reconcile.
 *
 * Every ProductionParallel carries this field.
 * All execution logic must branch on this value — never assume Mode 1 only.
 */
public enum ExecutionMode {
    REPLAY_VALIDATE,
    TRUE_PARALLEL
}
