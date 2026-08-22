/**
 * Goal Executor — Autonomous goal trigger checking.
 *
 * Time-based and idle goals are checked via Vital Impulse's
 * `resolveAutonomousIntent()` (wired in index.ts), which already calls
 * `checkAutonomousGoals()` from goal-stack.ts. This module only
 * provides initialization wiring and diagnostic stats.
 *
 * Autonomy loop:
 *  DMN/Introspection → Goal creation → Vital Impulse → resolveAutonomousIntent → Agent acts
 */

import type { BrainAgentConfig } from "./types.ts";

// ── Module state ──────────────────────────────────────────────────

let logger: { info: (msg: string) => void } | undefined;
let totalGoalsExecuted = 0;

// ── Initialization ────────────────────────────────────────────────

export function initGoalExecutor(
  _cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
): void {
  logger = log;
  totalGoalsExecuted = 0;

  logger.info("BrainAgent GoalExecutor: initialized (goals checked via vital impulse)");
}

export function stopGoalExecutor(): void {
  logger?.info("BrainAgent GoalExecutor: stopped.");
}

/** Increment executed goal count (called from index.ts when goals fire). */
export function recordGoalExecution(count: number): void {
  totalGoalsExecuted += count;
}

// ── Public API ────────────────────────────────────────────────────

export function getGoalExecutorStats(): {
  totalChecks: number;
  totalGoalsExecuted: number;
  lastHeartbeatTime: number;
} {
  return {
    totalChecks: 0,
    totalGoalsExecuted,
    lastHeartbeatTime: 0,
  };
}
