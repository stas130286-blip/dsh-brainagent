import { describe, it, expect } from "vitest";
import {
  createGoalExecutor,
  getGoalExecutorStats,
  initGoalExecutor,
  recordGoalExecution,
  stopGoalExecutor,
} from "./goal-executor.ts";
import { DEFAULT_CONFIG, type Goal } from "./types.ts";
import { createAutonomousIntentResolver, createAutonomyState } from "../plugin/autonomy.ts";

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

describe("v0.9.20: резолвер автономии учитывает исполнение целей", () => {
  it("сработавшие цели резолвера попадают в статистику goal-executor", () => {
    initGoalExecutor(DEFAULT_CONFIG, noopLog);
    const goal = {
      id: "g1",
      description: "проверить форум",
      trigger: { type: "interval" },
    } as unknown as Goal;
    const resolver = createAutonomousIntentResolver({
      state: createAutonomyState(),
      brainConfig: DEFAULT_CONFIG,
      drives: {},
      goalStack: {
        getGoalStackStats: () => ({ pending: 1 }),
        checkAutonomousGoals: () => [goal],
        buildGoalContext: () => "контекст цели",
        getDesires: () => [],
      },
    });
    const intent = resolver();
    expect(intent).not.toBeNull();
    expect(intent?.source).toBe("goal:g1");
    expect(getGoalExecutorStats().totalGoalsExecuted).toBe(1);
    stopGoalExecutor();
  });
});
