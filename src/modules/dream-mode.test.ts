import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_CONFIG } from "./types.ts";

// Mock hippocampus.consolidate before importing dream-mode
const mockConsolidate = vi
  .fn()
  .mockResolvedValue({ merged: 0, pruned: 0, strengthened: 0, contradictions: 0, revised: 0 });

let mockSemanticVersion = 0;

vi.mock("./hippocampus.ts", () => ({
  consolidate: (...args: unknown[]) => mockConsolidate(...args),
  getSemanticVersion: () => mockSemanticVersion,
}));

// Mock circadian-rhythm to capture the consolidation callback
let capturedConsolidationCallback: (() => Promise<void>) | null = null;

vi.mock("./circadian-rhythm.ts", () => ({
  setConsolidationCallback: (cb: () => Promise<void>) => {
    capturedConsolidationCallback = cb;
  },
  getSleepSettings: () => ({
    consolidationIntensity: 0.8,
    pruningAggressiveness: 0.6,
    synapticNormalization: true,
  }),
  isInSleepPhase: () => true,
}));

// Import after mock is set up
const { startDreamMode, stopDreamMode, forceConsolidation, getDreamStats } =
  await import("./dream-mode.ts");

describe("Dream Mode (memory consolidation)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockSemanticVersion = 0;
    capturedConsolidationCallback = null;
    // Ensure stopped state
    stopDreamMode();
  });

  afterEach(() => {
    stopDreamMode();
    vi.useRealTimers();
  });

  // ── Start / Stop ────────────────────────────────────────────

  describe("startDreamMode()", () => {
    it("starts the service", () => {
      startDreamMode(DEFAULT_CONFIG);
      expect(getDreamStats().isRunning).toBe(true);
    });

    it("no-op if already running", () => {
      const logger = { info: vi.fn() };
      startDreamMode(DEFAULT_CONFIG, logger);
      const callsAfterFirst = logger.info.mock.calls.length;
      startDreamMode(DEFAULT_CONFIG, logger);
      // Second call is a no-op — no additional log lines
      expect(logger.info).toHaveBeenCalledTimes(callsAfterFirst);
    });

    it("fires initial consolidation after 30s warmup", async () => {
      startDreamMode(DEFAULT_CONFIG);
      expect(mockConsolidate).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockConsolidate).toHaveBeenCalledOnce();
    });

    it("fires periodic consolidation at configured interval", async () => {
      const config = {
        ...DEFAULT_CONFIG,
        memory: { ...DEFAULT_CONFIG.memory, dreamIntervalMinutes: 1 },
      };
      startDreamMode(config);

      // Skip past warmup
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockConsolidate).toHaveBeenCalledTimes(1);

      // Skip one interval (1 minute)
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockConsolidate).toHaveBeenCalledTimes(2);

      // Another interval
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockConsolidate).toHaveBeenCalledTimes(3);
    });
  });

  describe("stopDreamMode()", () => {
    it("stops the service", () => {
      startDreamMode(DEFAULT_CONFIG);
      stopDreamMode();
      expect(getDreamStats().isRunning).toBe(false);
    });

    it("no-op if not running", () => {
      // Should not throw
      stopDreamMode();
      expect(getDreamStats().isRunning).toBe(false);
    });

    it("stops periodic consolidation", async () => {
      const config = {
        ...DEFAULT_CONFIG,
        memory: { ...DEFAULT_CONFIG.memory, dreamIntervalMinutes: 1 },
      };
      startDreamMode(config);
      await vi.advanceTimersByTimeAsync(30_000); // warmup fires
      expect(mockConsolidate).toHaveBeenCalledTimes(1);

      stopDreamMode();
      await vi.advanceTimersByTimeAsync(120_000); // should not fire more
      expect(mockConsolidate).toHaveBeenCalledTimes(1);
    });
  });

  // ── Force consolidation ─────────────────────────────────────

  describe("forceConsolidation()", () => {
    it("runs consolidation immediately", async () => {
      mockConsolidate.mockResolvedValue({
        merged: 2,
        pruned: 1,
        strengthened: 3,
        contradictions: 0,
        revised: 0,
      });
      const result = await forceConsolidation(DEFAULT_CONFIG);
      expect(mockConsolidate).toHaveBeenCalledWith(DEFAULT_CONFIG, undefined, undefined, 0.8);
      expect(result).toEqual({
        merged: 2,
        pruned: 1,
        strengthened: 3,
        contradictions: 0,
        revised: 0,
      });
    });

    it("updates lastConsolidation timestamp", async () => {
      const before = getDreamStats().lastConsolidation;
      await forceConsolidation(DEFAULT_CONFIG);
      expect(getDreamStats().lastConsolidation).toBeGreaterThanOrEqual(before);
    });

    it("logs results when logger provided", async () => {
      const logger = { info: vi.fn() };
      mockConsolidate.mockResolvedValue({
        merged: 1,
        pruned: 2,
        strengthened: 3,
        contradictions: 1,
      });
      await forceConsolidation(DEFAULT_CONFIG, logger);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("merged=1"));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("contradictions=1"));
    });
  });

  // ── Stats ───────────────────────────────────────────────────

  describe("getDreamStats()", () => {
    it("returns correct initial state", () => {
      const stats = getDreamStats();
      expect(stats.isRunning).toBe(false);
      expect(stats.isConsolidating).toBe(false);
    });

    it("reflects running state", () => {
      startDreamMode(DEFAULT_CONFIG);
      expect(getDreamStats().isRunning).toBe(true);
      stopDreamMode();
      expect(getDreamStats().isRunning).toBe(false);
    });
  });

  // ── Error handling ──────────────────────────────────────────

  describe("error handling", () => {
    it("continues running after consolidation error", async () => {
      const config = {
        ...DEFAULT_CONFIG,
        memory: { ...DEFAULT_CONFIG.memory, dreamIntervalMinutes: 1 },
      };
      const logger = { info: vi.fn() };
      mockConsolidate.mockRejectedValueOnce(new Error("consolidation failed"));

      startDreamMode(config, logger);
      await vi.advanceTimersByTimeAsync(30_000); // warmup fires (errors)
      expect(getDreamStats().isRunning).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("error"));

      // Should still fire next interval successfully
      mockConsolidate.mockResolvedValue({
        merged: 0,
        pruned: 0,
        strengthened: 0,
        contradictions: 0,
      });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockConsolidate).toHaveBeenCalledTimes(2);
    });
  });

  // ── Dirty flag (skip AI review) ────────────────────────────

  describe("circadian dirty flag", () => {
    it("skips AI review on second circadian call when semantic version unchanged", async () => {
      startDreamMode(DEFAULT_CONFIG);
      expect(capturedConsolidationCallback).not.toBeNull();

      // First circadian call — version is fresh, should NOT skip AI
      await capturedConsolidationCallback!();
      // 5th arg is skipAI: first call has lastConsolidatedVersion=-1 !== version 0 → skipAI=false
      expect(mockConsolidate).toHaveBeenLastCalledWith(
        DEFAULT_CONFIG,
        undefined,
        undefined,
        0.8,
        false,
      );

      // Second circadian call — version still 0, should skip AI
      mockConsolidate.mockClear();
      await capturedConsolidationCallback!();
      expect(mockConsolidate).toHaveBeenLastCalledWith(
        DEFAULT_CONFIG,
        undefined,
        undefined,
        0.8,
        true,
      );
    });

    it("runs AI review after semantic version changes", async () => {
      startDreamMode(DEFAULT_CONFIG);

      // First call — always full
      await capturedConsolidationCallback!();
      // Second call — skip (no change)
      await capturedConsolidationCallback!();
      expect(mockConsolidate).toHaveBeenLastCalledWith(
        DEFAULT_CONFIG,
        undefined,
        undefined,
        0.8,
        true,
      );

      // Simulate new fact stored (semantic version bumps)
      mockSemanticVersion = 1;
      mockConsolidate.mockClear();

      // Third call — dirty, should NOT skip AI
      await capturedConsolidationCallback!();
      expect(mockConsolidate).toHaveBeenLastCalledWith(
        DEFAULT_CONFIG,
        undefined,
        undefined,
        0.8,
        false,
      );
    });

    it("does not skip AI for interval-based consolidation", async () => {
      startDreamMode(DEFAULT_CONFIG);

      // Warmup fires (interval, not circadian) — should never skip
      await vi.advanceTimersByTimeAsync(30_000);
      // isInSleepPhase mock returns true, so intensity is 0.8
      expect(mockConsolidate).toHaveBeenLastCalledWith(
        DEFAULT_CONFIG,
        undefined,
        undefined,
        0.8,
        false,
      );
    });

    it("forceConsolidation always runs full AI review", async () => {
      startDreamMode(DEFAULT_CONFIG);

      // Run circadian twice to mark as clean
      await capturedConsolidationCallback!();
      await capturedConsolidationCallback!();
      mockConsolidate.mockClear();

      // forceConsolidation should NOT pass skipAIReview at all (defaults to false)
      await forceConsolidation(DEFAULT_CONFIG);
      expect(mockConsolidate).toHaveBeenCalledWith(DEFAULT_CONFIG, undefined, undefined, 0.8);
    });
  });
});
