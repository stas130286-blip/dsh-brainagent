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
 *
 * v0.6.1 (волна 1 миграции на per-instance состояние):
 *  - фабрика `createGoalExecutor()` создаёт инстанс со своим счётчиком;
 *  - module-level `let` остался один — слот активного инстанса для
 *    обратной совместимости init/stop; уйдёт с переходом на Cordis.
 */

import type { BrainAgentConfig } from "./types.ts";

type GoalExecutorStats = {
  totalChecks: number;
  totalGoalsExecuted: number;
  lastHeartbeatTime: number;
};

export type GoalExecutorInstance = {
  /** Increment executed goal count (called from index.ts when goals fire). */
  record(count: number): void;
  getStats(): GoalExecutorStats;
  /** Остановка с логом (для stop API). */
  stop(): void;
};

// ── Фабрика ───────────────────────────────────────────────────────

export function createGoalExecutor(
  log: { info: (msg: string) => void },
): GoalExecutorInstance {
  let totalGoalsExecuted = 0;

  function record(count: number): void {
    totalGoalsExecuted += count;
  }

  function getStats(): GoalExecutorStats {
    return {
      totalChecks: 0,
      totalGoalsExecuted,
      lastHeartbeatTime: 0,
    };
  }

  function stop(): void {
    log.info("BrainAgent GoalExecutor: stopped.");
  }

  return { record, getStats, stop };
}

// ── Слот активного инстанса (обратная совместимость init/stop) ───

let active: GoalExecutorInstance | undefined;

// ── Initialization ────────────────────────────────────────────────

export function initGoalExecutor(
  _cfg: BrainAgentConfig,
  log: { info: (msg: string) => void },
): void {
  active = createGoalExecutor(log);
  log.info("BrainAgent GoalExecutor: initialized (goals checked via vital impulse)");
}

export function stopGoalExecutor(): void {
  active?.stop();
  active = undefined;
}

/** Increment executed goal count (called from index.ts when goals fire). */
export function recordGoalExecution(count: number): void {
  active?.record(count);
}

// ── Public API ────────────────────────────────────────────────────

export function getGoalExecutorStats(): GoalExecutorStats {
  return (
    active?.getStats() ?? {
      totalChecks: 0,
      totalGoalsExecuted: 0,
      lastHeartbeatTime: 0,
    }
  );
}
