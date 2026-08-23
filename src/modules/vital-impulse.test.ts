import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initVitalImpulse,
  stopVitalImpulse,
  forceImpulse,
  consumeMotivation,
  resetConsecutiveFires,
  getConsecutiveAutonomousFires,
  getVitalImpulseStats,
} from "./vital-impulse.ts";
import { bus } from "./event-bus.ts";
import { DEFAULT_CONFIG } from "./types.ts";

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

/** dmn:insight-generated carries weight 0.4 in DEFAULT_SIGNAL_WEIGHTS. */
function emitInsight(description = "an idea"): void {
  bus.emitSync("dmn:insight-generated", { insightId: "test-insight", description });
}

let tempDir: string;
let deps: ReturnType<typeof makeDeps>;

describe("Vital Impulse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-vi-"));
    deps = makeDeps();
    initVitalImpulse(tempDir, makeConfig(), noopLog, deps);
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

  // ── Pressure accumulation ─────────────────────────────────────

  describe("pressure accumulation", () => {
    it("accumulates pressure from bus signals", () => {
      emitInsight();
      const stats = getVitalImpulseStats();
      expect(stats.currentPressure).toBeCloseTo(0.4, 5);
      expect(stats.totalSignalsReceived).toBe(1);
    });

    it("fires when pressure crosses the threshold", () => {
      emitInsight();
      emitInsight();
      emitInsight(); // 3 × 0.4 = 1.2 ≥ threshold 0.9
      const stats = getVitalImpulseStats();
      expect(stats.totalFires).toBe(1);
      expect(deps.requestHeartbeatNow).toHaveBeenCalledTimes(1);
      expect(deps.enqueueSystemEvent).toHaveBeenCalledWith("test intent", {
        contextKey: "vital-impulse",
      });
      expect(stats.currentPressure).toBe(0); // pressure resets on fire
    });

    it("raises the effective threshold after a fire (habituation)", () => {
      emitInsight();
      emitInsight();
      emitInsight();
      // habituationLevel 0.5 → threshold 0.9 × 1.5
      expect(getVitalImpulseStats().effectiveThreshold).toBeCloseTo(0.9 * 1.5, 5);
    });
  });

  // ── Refractory period ─────────────────────────────────────────

  describe("refractory period", () => {
    it("blocks re-fire inside the cooldown even under heavy pressure", () => {
      emitInsight();
      emitInsight();
      emitInsight(); // fire #1
      // GABA attenuates each signal to 0.1, but 20 of them push pressure
      // well past the habituated threshold — only the refractory holds.
      for (let i = 0; i < 20; i++) emitInsight();
      expect(getVitalImpulseStats().totalFires).toBe(1);
    });

    it("allows firing again after the cooldown elapses", () => {
      emitInsight();
      emitInsight();
      emitInsight(); // fire #1
      for (let i = 0; i < 20; i++) emitInsight();
      vi.advanceTimersByTime(31_000); // refractory is 30s
      emitInsight(); // triggers re-evaluation
      expect(getVitalImpulseStats().totalFires).toBe(2);
    });

    it("reports refractory state honestly in stats", () => {
      emitInsight();
      emitInsight();
      emitInsight();
      let stats = getVitalImpulseStats();
      expect(stats.isInRefractory).toBe(true);
      expect(stats.refractoryRemainingMs).toBeGreaterThan(0);
      expect(stats.refractoryRemainingMs).toBeLessThanOrEqual(30_000);

      vi.advanceTimersByTime(31_000);
      stats = getVitalImpulseStats();
      expect(stats.isInRefractory).toBe(false);
      expect(stats.refractoryRemainingMs).toBe(0);
    });
  });

  // ── Anti-spam counters ────────────────────────────────────────

  describe("anti-spam counters", () => {
    it("counts consecutive fires until the user responds", () => {
      emitInsight();
      emitInsight();
      emitInsight();
      expect(getConsecutiveAutonomousFires()).toBe(1);

      resetConsecutiveFires();
      expect(getConsecutiveAutonomousFires()).toBe(0);
      // habituation cleared → threshold back to baseline
      expect(getVitalImpulseStats().effectiveThreshold).toBeCloseTo(0.9, 5);
    });

    it("forceImpulse counts against habituation/GABA too", () => {
      forceImpulse("manual nudge");
      expect(deps.enqueueSystemEvent).toHaveBeenCalledWith("manual nudge", {
        contextKey: "vital-impulse",
      });
      const stats = getVitalImpulseStats();
      expect(stats.totalFires).toBe(1);
      expect(getConsecutiveAutonomousFires()).toBe(1);
      expect(stats.effectiveThreshold).toBeCloseTo(0.9 * 1.5, 5);
      expect(stats.isInRefractory).toBe(true);
    });
  });

  // ── Motivation context ────────────────────────────────────────

  describe("motivation context", () => {
    it("stores inner motivation on fire for single-use consumption", () => {
      emitInsight();
      emitInsight();
      emitInsight();
      const motivation = consumeMotivation();
      expect(motivation).toContain("autonomous-intent");
      expect(consumeMotivation()).toBeNull();
    });
  });
});
