import { describe, it, expect } from "vitest";
import {
  createGoalExecutor,
  getGoalExecutorStats,
  initGoalExecutor,
  recordGoalExecution,
  stopGoalExecutor,
} from "./goal-executor.ts";
import { DEFAULT_CONFIG } from "./types.ts";

const noopLog = { info: () => {} };

describe("goal executor per-instance состояние (v0.6.1)", () => {
  it("фабрика создаёт независимые инстансы", () => {
    const a = createGoalExecutor(noopLog);
    const b = createGoalExecutor(noopLog);
    a.record(2);
    a.record(1);
    expect(a.getStats().totalGoalsExecuted).toBe(3);
    // Второй инстанс не видит записи первого
    expect(b.getStats().totalGoalsExecuted).toBe(0);
  });

  it("обёртки делегируют в активный инстанс", () => {
    initGoalExecutor(DEFAULT_CONFIG, noopLog);
    recordGoalExecution(3);
    expect(getGoalExecutorStats().totalGoalsExecuted).toBe(3);
    stopGoalExecutor();
    // После stop активного инстанса нет — статистика нулевая
    expect(getGoalExecutorStats().totalGoalsExecuted).toBe(0);
    // record после stop молча игнорируется (до следующего init)
    recordGoalExecution(5);
    expect(getGoalExecutorStats().totalGoalsExecuted).toBe(0);
  });
});
