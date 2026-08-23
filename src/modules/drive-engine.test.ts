import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DriveEngine, type DriveEngineConfig, type DriveEngineSpec } from "./drive-engine.ts";
import { bus } from "./event-bus.ts";
import { flushAllPersists } from "./persist.ts";
import type { DopamineSignal } from "./types.ts";

const noopLog = { info: () => {} };

function makeConfig(overrides: Partial<DriveEngineConfig> = {}): DriveEngineConfig {
  return {
    rewardDomains: ["casual", "emotional"],
    rewardMultiplier: 0.6,
    initialSatiation: 0.5,
    baseDecayRate: 0.02,
    decayIntervalMs: 60_000,
    sleepDecayModifier: 0.5,
    maxSatiationBoost: 0.8,
    maxHistoryEntries: 20,
    needThresholds: { mild: 0.7, moderate: 0.5, strong: 0.3, urgent: 0.15 },
    dmnBiasIntervalMs: 5 * 60 * 1000,
    desireUpdateIntervalMs: 2 * 60 * 1000,
    ...overrides,
  };
}

function makeSpec(overrides: Partial<DriveEngineSpec> = {}): DriveEngineSpec {
  return {
    id: "test-drive",
    logName: "TestDrive",
    desireType: "connection",
    desireDescription: "test urge",
    factsCategory: "relationship",
    fallbackTopic: "test topics",
    firedBaseBoost: 0.3,
    urgeTimeField: "timeSinceLastTest",
    legacyKeys: {
      lastInteraction: "lastTestInteractionTime",
      totalRewards: "totalTestRewards",
      history: "testInteractionHistory",
    },
    ...overrides,
  };
}

function makeDeps() {
  return {
    addDesire: vi.fn(() => ({}) as never),
    getDesires: vi.fn(() => []),
    getFactsByCategory: vi.fn(() => []),
    generateThought: vi.fn(),
  };
}

function dopamineSignal(domain: string, reward: number): DopamineSignal {
  return {
    reward,
    predictionError: 0,
    participatingModules: [],
    creditAssignment: {},
    context: { domain, complexity: "low", emotion: "neutral", input: "test" },
  } as DopamineSignal;
}

function vitalFired(consecutiveFires: number) {
  return { pressure: 1, signalCount: 5, motivation: "test", consecutiveFires };
}

let tempDir: string;
let engine: DriveEngine | undefined;

describe("DriveEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-engine-"));
  });

  afterEach(() => {
    engine?.stop();
    engine = undefined;
    flushAllPersists();
    vi.useRealTimers();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  function spawn(
    cfgOverrides?: Partial<DriveEngineConfig>,
    specOverrides?: Partial<DriveEngineSpec>,
  ): { deps: ReturnType<typeof makeDeps>; eng: DriveEngine } {
    const deps = makeDeps();
    const eng = new DriveEngine(
      makeSpec(specOverrides),
      makeConfig(cfgOverrides),
      tempDir,
      false,
      deps,
      noopLog,
    );
    engine = eng;
    return { deps, eng };
  }

  // ── Награды и фильтр доменов ──────────────────────────────────

  it("boosts satiation only for rewards of its own domains", () => {
    const { eng } = spawn();
    bus.emitSync("dopamine:reward", dopamineSignal("technical", 0.5));
    expect(eng.getSatiation()).toBeCloseTo(0.5, 5);

    bus.emitSync("dopamine:reward", dopamineSignal("casual", 0.5));
    // 0.5 + min(0.8, 0.5 × 0.6) = 0.8
    expect(eng.getSatiation()).toBeCloseTo(0.8, 5);
  });

  it("negative reward slightly drains satiation", () => {
    const { eng } = spawn();
    bus.emitSync("dopamine:reward", dopamineSignal("casual", -0.5));
    // 0.5 − |−0.5| × 0.1 = 0.45
    expect(eng.getSatiation()).toBeCloseTo(0.45, 5);
  });

  // ── Затухание и уровни потребности ────────────────────────────

  it("decays over time and raises need level with signals", () => {
    const { deps, eng } = spawn();
    const seen: unknown[] = [];
    const unsub = bus.on("test-drive:need-rising" as "social-drive:need-rising", (d: unknown) => {
      seen.push(d);
    });

    vi.advanceTimersByTime(30 * 60 * 1000);
    const stats = eng.getStats();
    unsub();

    expect(stats.satiation).toBeLessThan(0.35);
    expect(stats.needLevel).not.toBe("none");
    expect(seen.length).toBeGreaterThan(0);
    expect(deps.addDesire).toHaveBeenCalled(); // moderate+ → желание
    expect(deps.generateThought).toHaveBeenCalled(); // strong+ → смещение DMN
  });

  it("emits urge signal at urgent level with spec time field", () => {
    const { eng } = spawn();
    const urges: Array<Record<string, unknown>> = [];
    const unsub = bus.on("test-drive:urge" as "social-drive:urge", (d: unknown) => {
      urges.push(d as Record<string, unknown>);
    });

    vi.advanceTimersByTime(120 * 60 * 1000); // глубокое затухание
    eng.getStats();
    unsub();

    expect(urges.length).toBeGreaterThan(0);
    expect(urges[0]).toHaveProperty("timeSinceLastTest");
  });

  // ── Витальный импульс ─────────────────────────────────────────

  it("vital-impulse fires escalate satiation boost", () => {
    const { eng } = spawn();
    bus.emitSync("vital-impulse:fired", vitalFired(0));
    expect(eng.getSatiation()).toBeCloseTo(0.8, 5); // 0.5 + 0.3

    bus.emitSync("vital-impulse:fired", vitalFired(2));
    // 0.3 + min(0.3×2×0.5, 0.5) = 0.6 → 0.8 + 0.6 → cap 1.0
    expect(eng.getSatiation()).toBeCloseTo(1.0, 5);
  });

  // ── Ручные бусты и дельты ─────────────────────────────────────

  it("boostSatiation clamps to 1 and emits satiated", () => {
    const { eng } = spawn();
    const events: Array<{ boostAmount: number }> = [];
    const unsub = bus.on("test-drive:satiated" as "social-drive:satiated", (d) => {
      events.push(d as { boostAmount: number });
    });
    eng.boostSatiation(0.9, "test");
    unsub();
    expect(eng.getSatiation()).toBe(1);
    expect(events.length).toBe(1);
    expect(events[0].boostAmount).toBeCloseTo(0.5, 5); // только до потолка
  });

  it("applySatiationDelta clamps and recomputes need level", () => {
    const { eng } = spawn();
    eng.applySatiationDelta(-0.35);
    const stats = eng.getStats();
    expect(stats.satiation).toBeCloseTo(0.15, 5);
    expect(["urgent", "strong"]).toContain(stats.needLevel);
  });

  // ── Персистентность ───────────────────────────────────────────

  it("persists state to its own storage dir on stop", () => {
    spawn({}, { id: "persist-drive" });
    bus.emitSync("dopamine:reward", dopamineSignal("casual", 0.5));
    engine?.stop();
    engine = undefined;

    const stateFile = join(tempDir, ".brainagent", "persist-drive", "state.json");
    expect(existsSync(stateFile)).toBe(true);
    const saved = JSON.parse(readFileSync(stateFile, "utf-8")) as Record<string, unknown>;
    expect(saved.satiation).toBeCloseTo(0.8, 5);
    expect(saved.totalRewards).toBe(1);
  });

  // ── Миграция состояния 0.1.1 ──────────────────────────────────

  it("loads legacy 0.1.1 state-file keys transparently", () => {
    const dir = join(tempDir, ".brainagent", "legacy-drive");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "state.json"),
      JSON.stringify({
        satiation: 0.7,
        lastTestInteractionTime: 12345,
        totalTestRewards: 7,
        testInteractionHistory: [{ timestamp: 12345, reward: 0.5, context: "casual" }],
      }),
      "utf-8",
    );

    spawn({}, { id: "legacy-drive" });
    const stats = engine!.getStats();

    expect(stats.satiation).toBeCloseTo(0.7, 5);
    expect(stats.lastInteractionTime).toBe(12345);
    expect(stats.totalRewards).toBe(7);
    expect(stats.recentInteractionCount).toBe(1);
  });
});
