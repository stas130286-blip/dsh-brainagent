import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initCircadianRhythm,
  stopCircadianRhythm,
  setConsolidationCallback,
  getCircadianState,
  getCircadianStats,
  recordActivity,
  forcePhase,
  isInSleepPhase,
  isInWakePhase,
  getCircadianModulation,
  getSleepSettings,
} from "./circadian-rhythm.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tempDir: string;

describe("Circadian Rhythm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-circ-"));
    initCircadianRhythm(tempDir, DEFAULT_CONFIG);
  });

  afterEach(() => {
    stopCircadianRhythm();
    vi.useRealTimers();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts in wake phase", () => {
      expect(getCircadianState().phase).toBe("wake");
    });

    it("returns wake modulation by default", () => {
      const mod = getCircadianModulation();
      expect(mod.dopamine).toBeGreaterThan(1);
      expect(mod.acetylcholine).toBeGreaterThan(1);
    });

    it("is in wake phase initially", () => {
      expect(isInWakePhase()).toBe(true);
      expect(isInSleepPhase()).toBe(false);
    });
  });

  // ── Phase transitions ───────────────────────────────────────

  describe("forcePhase()", () => {
    it("forces transition to sleep", () => {
      forcePhase("sleep");
      expect(getCircadianState().phase).toBe("sleep");
      expect(isInSleepPhase()).toBe(true);
    });

    it("forces transition back to wake", () => {
      forcePhase("sleep");
      forcePhase("wake");
      expect(getCircadianState().phase).toBe("wake");
      expect(isInWakePhase()).toBe(true);
    });

    it("resets sleepConsolidations on new sleep phase", () => {
      forcePhase("sleep");
      // sleepConsolidations starts at 0
      expect(getCircadianStats().sleepConsolidations).toBe(0);
    });
  });

  // ── Sleep consolidation cap ─────────────────────────────────

  describe("max sleep consolidations", () => {
    it("stops triggering consolidation after 5 cycles", async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      setConsolidationCallback(mockCallback);

      // Force into sleep phase
      forcePhase("sleep");

      // Advance time enough for consolidation cycles (each ~30s, eval every 10s)
      // Need >30s for first consolidation, then ~30s for each additional
      await vi.advanceTimersByTimeAsync(300_000);

      // Should have been called at most 5 times
      expect(mockCallback.mock.calls.length).toBeLessThanOrEqual(5);
      expect(mockCallback.mock.calls.length).toBeGreaterThan(0);
    });

    it("resets cap after waking and sleeping again", async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);
      setConsolidationCallback(mockCallback);

      // First sleep session — exhaust the cap
      forcePhase("sleep");
      await vi.advanceTimersByTimeAsync(300_000);

      const firstSessionCalls = mockCallback.mock.calls.length;
      expect(firstSessionCalls).toBeGreaterThan(0);
      expect(firstSessionCalls).toBeLessThanOrEqual(5);

      // Wake up, then sleep again — counter resets
      forcePhase("wake");
      mockCallback.mockClear();
      forcePhase("sleep");

      await vi.advanceTimersByTimeAsync(300_000);

      // Second session should also get consolidation calls
      expect(mockCallback.mock.calls.length).toBeGreaterThan(0);
      expect(mockCallback.mock.calls.length).toBeLessThanOrEqual(5);
    });
  });

  // ── Activity recording ──────────────────────────────────────

  describe("recordActivity()", () => {
    it("increments wake interactions", () => {
      recordActivity();
      recordActivity();
      expect(getCircadianStats().wakeInteractions).toBe(2);
    });
  });

  // ── Sleep settings ──────────────────────────────────────────

  describe("getSleepSettings()", () => {
    it("returns consolidation settings", () => {
      const settings = getSleepSettings();
      expect(settings).toHaveProperty("consolidationIntensity");
      expect(settings).toHaveProperty("pruningAggressiveness");
      expect(settings).toHaveProperty("synapticNormalization");
    });
  });
});
