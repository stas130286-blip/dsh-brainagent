import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bus } from "./event-bus.ts";
import { flushAllPersists } from "./persist.ts";
import { DEFAULT_CONFIG, type BrainAgentConfig, type DopamineSignal } from "./types.ts";
import {
  initRewardLedger,
  stopRewardLedger,
  recordReward,
  getRecentEntries,
  getAverageReward,
  getRewardLedgerStats,
} from "./reward-ledger.ts";

function dopamineSignal(domain: string, reward: number): DopamineSignal {
  return {
    reward,
    predictionError: 0,
    participatingModules: [],
    creditAssignment: {},
    context: { domain, complexity: "low", emotion: "neutral", input: "test" },
  } as DopamineSignal;
}

function makeConfig(overrides: Partial<BrainAgentConfig["learningLoop"]> = {}): BrainAgentConfig {
  return {
    ...DEFAULT_CONFIG,
    learningLoop: { ...DEFAULT_CONFIG.learningLoop, ...overrides },
  };
}

describe("reward ledger", () => {
  let dir: string;
  const unsubs: Array<() => void> = [];

  function trackOn<K extends Parameters<typeof bus.on>[0]>(
    event: K,
    handler: Parameters<typeof bus.on<K>>[1],
  ) {
    unsubs.push(bus.on(event, handler));
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "reward-ledger-test-"));
    initRewardLedger(dir, makeConfig());
  });

  afterEach(() => {
    stopRewardLedger();
    for (const unsub of unsubs.splice(0)) unsub();
    rmSync(dir, { recursive: true, force: true });
  });

  it("records dopamine reward with the dopamine weight", () => {
    bus.emitSync("dopamine:reward", dopamineSignal("technical", 0.8));

    const entries = getRecentEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe("dopamine");
    expect(entries[0].reward).toBeCloseTo(0.4, 3); // 0.8 * 0.5
    expect(entries[0].context).toBe("technical");
  });

  it("records proactive reactions with user-signal weights", () => {
    bus.emitSync("proactive:reaction", { domain: "research", signal: "rejection", hits: ["не надо"] });
    bus.emitSync("proactive:reaction", { domain: "research", signal: "positive", hits: ["спасибо"] });

    const entries = getRecentEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].reward).toBeCloseTo(-1, 3);
    expect(entries[1].reward).toBeCloseTo(0.8, 3);
  });

  it("records basal reinforcement and skips neutral", () => {
    bus.emitSync("basal:reinforced", { habitId: "h1", signal: "positive" });
    bus.emitSync("basal:reinforced", { habitId: "h2", signal: "neutral" });

    const entries = getRecentEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe("basal-reinforcement");
    expect(entries[0].reward).toBeCloseTo(0.6, 3);
  });

  it("records cerebellum validation (fail weighs more than pass)", () => {
    bus.emitSync("cerebellum:validated", { passed: true, issues: [] });
    bus.emitSync("cerebellum:validated", { passed: false, issues: ["x"] });

    const entries = getRecentEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].reward).toBeCloseTo(0.3, 3);
    expect(entries[1].reward).toBeCloseTo(-0.3, 3); // clamp(-1.3) = -1, затем вес 0.3
  });

  it("records prediction validation outcomes", () => {
    bus.emitSync("pathway:prediction-validated", { predictionTopic: "topic", wasCorrect: true });
    bus.emitSync("pathway:prediction-validated", { predictionTopic: "topic", wasCorrect: false });

    const entries = getRecentEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].reward).toBeCloseTo(0.4, 3);
    expect(entries[1].reward).toBeCloseTo(-0.4, 3);
  });

  it("clamps manual rewards to [-1, 1] and skips zero", () => {
    recordReward("manual", 5);
    recordReward("manual", -5);
    recordReward("manual", 0);

    const entries = getRecentEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].reward).toBe(1);
    expect(entries[1].reward).toBe(-1);
  });

  it("trims the journal to maxEntries", () => {
    stopRewardLedger();
    initRewardLedger(dir, makeConfig({ rewardLedger: { enabled: true, maxEntries: 3 } }));

    for (let i = 0; i < 10; i++) {
      recordReward("manual", 0.1);
    }

    expect(getRecentEntries().length).toBe(3);
    expect(getRewardLedgerStats().entries).toBe(3);
  });

  it("computes average reward over the recent window", () => {
    recordReward("manual", 1);
    recordReward("manual", -1);
    recordReward("manual", 0.5);

    expect(getAverageReward()).toBeCloseTo(0.5 / 3, 3);
    expect(getAverageReward(1)).toBeCloseTo(0.5, 3);
  });

  it("persists the journal across restarts", () => {
    recordReward("manual", 0.25, "ctx-a");
    flushAllPersists();
    stopRewardLedger();

    initRewardLedger(dir, makeConfig());
    const entries = getRecentEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].reward).toBeCloseTo(0.25, 3);
    expect(entries[0].context).toBe("ctx-a");
  });

  it("emits reward:recorded with the clamped reward", () => {
    const seen: number[] = [];
    trackOn("reward:recorded", (data) => {
      seen.push(data.reward);
    });

    recordReward("manual", 2);

    expect(seen).toEqual([1]);
  });
});
