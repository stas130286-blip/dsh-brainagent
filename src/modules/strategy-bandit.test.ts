import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bus } from "./event-bus.ts";
import { flushAllPersists } from "./persist.ts";
import { DEFAULT_CONFIG, type BrainAgentConfig } from "./types.ts";
import {
  initStrategyBandit,
  stopStrategyBandit,
  chooseArm,
  recordOutcome,
  getArmStats,
  getBanditStats,
} from "./strategy-bandit.ts";

type LoopOverrides = {
  explorationConstant?: number;
  attributionWindowMs?: number;
};

function makeConfig(overrides: LoopOverrides = {}): BrainAgentConfig {
  return {
    ...DEFAULT_CONFIG,
    learningLoop: {
      ...DEFAULT_CONFIG.learningLoop,
      strategyBandit: { ...DEFAULT_CONFIG.learningLoop.strategyBandit, ...overrides },
    },
  };
}

describe("strategy bandit", () => {
  let dir: string;
  const unsubs: Array<() => void> = [];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "strategy-bandit-test-"));
    initStrategyBandit(dir, makeConfig());
  });

  afterEach(() => {
    stopStrategyBandit();
    for (const unsub of unsubs.splice(0)) unsub();
    rmSync(dir, { recursive: true, force: true });
  });

  it("explores unplayed arms first", () => {
    const first = chooseArm("dp", ["a", "b"]);
    const second = chooseArm("dp", ["a", "b"]);

    expect([first, second].sort()).toEqual(["a", "b"]);
  });

  it("exploits the arm with higher mean reward", () => {
    initStrategyBandit; // noop: config already loaded in beforeEach
    stopStrategyBandit();
    initStrategyBandit(dir, makeConfig({ explorationConstant: 0.1 }));

    for (let i = 0; i < 10; i++) {
      recordOutcome("dp", "good", 1);
      recordOutcome("dp", "bad", -1);
    }

    expect(chooseArm("dp", ["good", "bad"])).toBe("good");
  });

  it("clamps outcome rewards to [-1, 1]", () => {
    recordOutcome("dp", "arm", 5);
    recordOutcome("dp", "arm", -5);

    const stats = getArmStats("dp");
    expect(stats.arm.plays).toBe(2);
    expect(stats.arm.meanReward).toBe(0); // (1 + -1) / 2
  });

  it("attributes the next reward-ledger entry to the last choice", () => {
    const arm = chooseArm("context-verbosity", ["lean", "standard"]);
    bus.emitSync("reward:recorded", { reward: 0.7, source: "manual" });

    const stats = getArmStats("context-verbosity");
    expect(stats[arm].plays).toBe(1);
    expect(stats[arm].meanReward).toBeCloseTo(0.7, 3);
  });

  it("attributes one reward per choice only", () => {
    chooseArm("dp", ["a", "b"]);
    bus.emitSync("reward:recorded", { reward: 0.5, source: "manual" });
    bus.emitSync("reward:recorded", { reward: 0.5, source: "manual" });

    expect(getBanditStats().totalPlays).toBe(1);
  });

  it("drops attribution after the window expires", () => {
    vi.useFakeTimers();
    try {
      stopStrategyBandit();
      initStrategyBandit(dir, makeConfig({ attributionWindowMs: 100 }));
      chooseArm("dp", ["a", "b"]);
      vi.advanceTimersByTime(200);
      bus.emitSync("reward:recorded", { reward: 0.5, source: "manual" });
      expect(getBanditStats().totalPlays).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back safely when not initialized", () => {
    stopStrategyBandit();
    expect(chooseArm("dp", ["lean", "standard"])).toBe("standard");
    expect(chooseArm("dp", ["x", "y"])).toBe("x");
    expect(chooseArm("dp", [])).toBe("standard");
  });

  it("emits bandit:arm-chosen events", () => {
    const seen: string[] = [];
    unsubs.push(
      bus.on("bandit:arm-chosen", (data) => {
        seen.push(data.arm);
      }),
    );

    chooseArm("dp", ["a", "b"]);

    expect(seen).toHaveLength(1);
  });

  it("persists arm statistics across restarts", () => {
    recordOutcome("dp", "arm", 0.5);
    flushAllPersists();
    stopStrategyBandit();

    initStrategyBandit(dir, makeConfig());
    const stats = getArmStats("dp");
    expect(stats.arm.plays).toBe(1);
    expect(stats.arm.meanReward).toBeCloseTo(0.5, 3);
  });

  it("attributes each reward to the most recent choice across decision points", () => {
    chooseArm("dp1", ["a1", "b1"]);
    chooseArm("dp2", ["a2", "b2"]);

    bus.emitSync("reward:recorded", { reward: 0.6, source: "manual" });
    expect(getArmStats("dp2").a2.meanReward).toBeCloseTo(0.6, 3); // поздний выбор
    expect(getArmStats("dp1").a1.plays).toBe(0); // dp1 ещё не атрибутирован

    bus.emitSync("reward:recorded", { reward: -0.4, source: "manual" });
    expect(getArmStats("dp1").a1.meanReward).toBeCloseTo(-0.4, 3); // слот dp2 уже consumed
  });
});
