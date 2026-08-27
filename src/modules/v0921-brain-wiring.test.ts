import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initVitalImpulse,
  stopVitalImpulse,
  getVitalImpulseStats,
} from "./vital-impulse.ts";
import { bus } from "./event-bus.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import { createGoalStack } from "./goal-stack.ts";
import { initMemoryStorage, storeFact } from "./hippocampus.ts";
import {
  initDMN,
  runAssociationFinding,
  prepareProactiveContext,
  getDMNStats,
} from "./dmn.ts";

const noopLog = { info: () => {} };

function makeConfig() {
  return {
    ...DEFAULT_CONFIG,
    circadian: { ...DEFAULT_CONFIG.circadian, enabled: false },
  };
}

function makeDeps() {
  return {
    requestHeartbeatNow: vi.fn(),
    enqueueSystemEvent: vi.fn(),
    resolveAutonomousIntent: () => ({ text: "test intent", source: "test" }),
  };
}

// ════════════════════════════════════════════════════════════════
// W21-1: metabolic fatigue raises the initiative threshold
// ════════════════════════════════════════════════════════════════

describe("v0.9.21: metabolic fatigue", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-w21-"));
    initVitalImpulse(tempDir, makeConfig(), noopLog, makeDeps());
  });

  afterEach(() => {
    stopVitalImpulse();
    vi.useRealTimers();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("energy-low raises the effective threshold, rebalance restores it", () => {
    const base = getVitalImpulseStats().effectiveThreshold;
    bus.emitSync("metabolic:energy-low", { module: "hippocampus", energy: 0.1 });
    bus.emitSync("metabolic:energy-low", { module: "workingMemory", energy: 0.1 });
    expect(getVitalImpulseStats().effectiveThreshold).toBeCloseTo(base * 1.5, 5);

    bus.emitSync("metabolic:rebalanced", { changes: [] });
    expect(getVitalImpulseStats().effectiveThreshold).toBeCloseTo(base, 5);
  });

  it("caps fatigue at +75% of the threshold", () => {
    const base = getVitalImpulseStats().effectiveThreshold;
    for (let i = 0; i < 6; i++) {
      bus.emitSync("metabolic:energy-low", { module: "hippocampus", energy: 0.1 });
    }
    expect(getVitalImpulseStats().effectiveThreshold).toBeCloseTo(base * 1.75, 5);
  });
});

// ════════════════════════════════════════════════════════════════
// W21-2: emergent insight contributes weighted pressure
// ════════════════════════════════════════════════════════════════

describe("v0.9.21: emergent insight signal", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-w21-"));
    initVitalImpulse(tempDir, makeConfig(), noopLog, makeDeps());
  });

  afterEach(() => {
    stopVitalImpulse();
    vi.useRealTimers();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("pattern-established adds 0.45 of pressure", () => {
    bus.emitSync("emergent:pattern-established", {
      id: "p1",
      name: "Morning Briefing",
      confidence: 0.8,
    });
    const stats = getVitalImpulseStats();
    expect(stats.currentPressure).toBeCloseTo(0.45, 5);
    expect(stats.totalSignalsReceived).toBe(1);
    expect(stats.totalFires).toBe(0); // below the 0.9 threshold on its own
  });
});

// ════════════════════════════════════════════════════════════════
// W21-3: expired autonomous goals extinguish desires
// ════════════════════════════════════════════════════════════════

describe("v0.9.21: goal expiration extinction", () => {
  it("weakens desires when a non-user goal expires", () => {
    const stack = createGoalStack("");
    stack.addDesire("understanding", "рассказать про паттерн", 0.8, "autonomy");
    stack.createGoal(
      "проверить паттерн",
      { type: "time", condition: String(Date.now()) },
      "autonomy",
      "ctx",
      0.5,
      -10_000, // already expired
    );

    stack.expireGoals();

    expect(stack.getDesires()[0].strength).toBeCloseTo(0.68, 5);
    expect(stack.getGoalStackStats().extinctions).toBe(1);
  });

  it("does not extinguish desires for user-sourced goals", () => {
    const stack = createGoalStack("");
    stack.addDesire("connection", "спросить как дела", 0.8, "user");
    stack.createGoal(
      "напомнить пользователю",
      { type: "time", condition: String(Date.now()) },
      "user",
      "ctx",
      0.5,
      -10_000,
    );

    stack.expireGoals();

    expect(stack.getDesires()[0].strength).toBeCloseTo(0.8, 5);
    expect(stack.getGoalStackStats().extinctions).toBe(0);
  });

  it("leaves near-dead desires untouched", () => {
    const stack = createGoalStack("");
    stack.addDesire("exploration", "почти угасшее", 0.04, "autonomy");
    stack.createGoal(
      "авто-цель",
      { type: "time", condition: String(Date.now()) },
      "autonomy",
      "ctx",
      0.5,
      -10_000,
    );

    stack.expireGoals();

    expect(stack.getDesires()[0].strength).toBeCloseTo(0.04, 5);
    expect(stack.getGoalStackStats().extinctions).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════
// W21-4: DMN proactive drafts get prepared and counted
// ════════════════════════════════════════════════════════════════

describe("v0.9.21: DMN proactive context", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-w21-dmn-"));
    initMemoryStorage(tempDir);
    initDMN(tempDir, DEFAULT_CONFIG);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  it("starts with zero prepared drafts", () => {
    expect(getDMNStats().proactiveContextsPrepared).toBe(0);
  });

  it("prepares a draft for a confident prediction and marks the insight used", async () => {
    // Two cross-category facts with strong (but <0.85 near-dup) word
    // overlap guarantee a cross-domain association above minSimilarity.
    storeFact("event driven pipeline orchestrates deployment tasks in production", "definition");
    storeFact("event driven pipeline coordinates deployment plans for releases", "plan");
    await runAssociationFinding(DEFAULT_CONFIG);

    const block = prepareProactiveContext([{ topic: "definition", confidence: 0.8 }]);
    expect(block).toContain("proactive-insight");
    expect(getDMNStats().proactiveContextsPrepared).toBe(1);

    // The insight is now marked useful — the same topic yields nothing again.
    expect(prepareProactiveContext([{ topic: "definition", confidence: 0.8 }])).toBeUndefined();
    expect(getDMNStats().proactiveContextsPrepared).toBe(1);
  });
});
