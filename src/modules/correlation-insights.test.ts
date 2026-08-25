/**
 * v0.9.19: корреляционные инсайты не должны рождаться из синхронно
 * одинаковых последовательностей наград (структурный шум), но обязаны
 * сохраняться, когда модули реально расходятся.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { bus } from "./event-bus.ts";
import { initLearningCoordinator, getLearningStats } from "./learning-coordinator.ts";
import type { DopamineSignal } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

function emitSignal(creditA: number, reward = 1): void {
  const signal: DopamineSignal = {
    reward,
    predictionError: reward - 0.5,
    participatingModules: ["moduleA", "moduleB"],
    creditAssignment: { moduleA: creditA, moduleB: 1 - creditA },
    context: {
      domain: "technical",
      complexity: "moderate",
      emotion: "neutral",
      input: "test input",
    },
  };
  bus.emitSync("dopamine:reward", signal);
}

describe("v0.9.19: корреляционные инсайты", () => {
  beforeEach(() => {
    const tmp = mkdtempSync(join(tmpdir(), "brainagent-corr-test-"));
    initLearningCoordinator(tmp, DEFAULT_CONFIG);
  });

  it("синхронные одинаковые награды не рождают корреляционный инсайт", () => {
    // Награда варьируется (есть дисперсия), но обоим модулям достаётся
    // одно и то же значение — раньше это давало ложное r=1.00.
    for (let i = 0; i < 10; i++) emitSignal(0.5, 0.4 + (i % 3) * 0.1);
    const stats = getLearningStats();
    expect(stats.recentInsights.filter((i) => i.type === "correlation")).toHaveLength(0);
  });

  it("реально расходящиеся модули по-прежнему дают инсайт", () => {
    // Антифаза: у A высоко, когда у B низко → r ≈ −1 (анти-корреляция).
    for (let i = 0; i < 10; i++) emitSignal(i % 2 === 0 ? 0.9 : 0.1);
    const stats = getLearningStats();
    const corr = stats.recentInsights.filter((i) => i.type === "correlation");
    expect(corr.length).toBeGreaterThan(0);
  });
});
