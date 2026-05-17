package com.paralleliq.domain.model;

/**
 * The two operating modes of ParallelIQ.
 *
 * REPLAY_VALIDATE (Mode 1 — current):
 *   Capture from Env A → transform → replay to Env B → compare Env B output against Env A baseline.
 *   Env A is the source of truth.
 *
 * TRUE_PARALLEL (Mode 2 — future phase):
 *   Inject the same data stimulus into both Env A and Env B simultaneously.
 *   Capture outputs from each independently.
 *   Reconcile: neither environment is the master — prove they produce identical results.
 *
 * Every ProductionParallel carries this field. All execution, correlation, and assertion
 * logic must branch on this value — never assume REPLAY_VALIDATE is the only mode.
 *
 * Design rule: when adding new logic, ask "does this work for both modes?"
 * If not, add a mode-specific branch rather than a hardcoded assumption.
 */
public enum ExecutionMode {

    /**
     * Capture Env A → replay to Env B → compare outputs.
     * Env A output = expected. Env B output = actual.
     */
    REPLAY_VALIDATE,

    /**
     * Inject same input to both environments concurrently.
     * Capture both outputs independently.
     * Compare Env A output vs Env B output — no fixed expected/actual roles.
     * Not yet implemented — reserved for Mode 2 milestone.
     */
    TRUE_PARALLEL
}
