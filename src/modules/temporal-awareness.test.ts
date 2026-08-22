import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bus } from "./event-bus.ts";
import {
  initTemporalAwareness,
  stopTemporalAwareness,
  getTemporalAwarenessStats,
  recordInteraction,
  buildTemporalContext,
} from "./temporal-awareness.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tempDir: string;
const unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Temporal Awareness", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-temporal-"));
  });

  afterEach(() => {
    stopTemporalAwareness();
    for (const unsub of unsubs) unsub();
    unsubs.length = 0;
    bus.gc(0);
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("initializes with zero state", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      const stats = getTemporalAwarenessStats();
      expect(stats.totalInteractions).toBe(0);
      expect(stats.typicalGapMs).toBe(0);
    });
  });

  // ── Recording interactions ──────────────────────────────────

  describe("recording interactions", () => {
    it("increments total interactions on recordInteraction", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction();
      expect(getTemporalAwarenessStats().totalInteractions).toBe(1);
      recordInteraction();
      expect(getTemporalAwarenessStats().totalInteractions).toBe(2);
    });

    it("tracks last interaction time", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      const before = Date.now();
      recordInteraction();
      const stats = getTemporalAwarenessStats();
      expect(stats.lastInteractionTime).toBeGreaterThanOrEqual(before);
    });

    it("computes current gap from last interaction", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction();
      const stats = getTemporalAwarenessStats();
      // Gap should be very small since we just recorded
      expect(stats.currentGapMs).toBeGreaterThanOrEqual(0);
      expect(stats.currentGapMs).toBeLessThan(1000);
    });
  });

  // ── Typical gap EMA ─────────────────────────────────────────

  describe("typical gap EMA", () => {
    it("bootstraps typical gap from first gap", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction(); // First interaction — no gap
      recordInteraction(); // Second interaction — gap computed
      const stats = getTemporalAwarenessStats();
      // typicalGapMs should now be set (small value since immediate calls)
      expect(stats.typicalGapMs).toBeGreaterThanOrEqual(0);
    });

    it("updates typical gap via EMA on subsequent interactions", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction();
      recordInteraction();
      const gap1 = getTemporalAwarenessStats().typicalGapMs;
      recordInteraction();
      const gap2 = getTemporalAwarenessStats().typicalGapMs;
      expect(gap2).toBeGreaterThanOrEqual(0);
      expect(typeof gap1).toBe("number");
    });
  });

  // ── Density computation ─────────────────────────────────────

  describe("interaction density", () => {
    it("computes density as interactions per day", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      // Record several interactions rapidly
      for (let i = 0; i < 10; i++) {
        recordInteraction();
      }
      const stats = getTemporalAwarenessStats();
      // High density since all happened in milliseconds
      expect(stats.interactionDensity).toBeGreaterThan(0);
    });

    it("density is 0 with insufficient interactions", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction(); // only 1 interaction
      expect(getTemporalAwarenessStats().interactionDensity).toBe(0);
    });
  });

  // ── Temporal surprise ───────────────────────────────────────

  describe("temporal surprise", () => {
    it("surprise is 1 when typicalGap is 0", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction();
      // No gap computed yet → surprise should be 1
      const stats = getTemporalAwarenessStats();
      expect(stats.temporalSurprise).toBe(1);
    });
  });

  // ── Event emission ──────────────────────────────────────────

  describe("event emission", () => {
    it("emits temporal:frequent-engagement at high density", () => {
      const events: Array<{ density: number }> = [];
      initTemporalAwareness(
        tempDir,
        {
          ...DEFAULT_CONFIG,
          temporalAwareness: {
            ...DEFAULT_CONFIG.temporalAwareness,
            highDensityThreshold: 1.0, // Very low threshold to trigger
          },
        },
        undefined,
      );

      trackOn("temporal:frequent-engagement", (data) => {
        events.push(data as { density: number });
      });

      // Record enough interactions to trigger
      for (let i = 0; i < 5; i++) {
        recordInteraction();
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].density).toBeGreaterThan(0);
    });
  });

  // ── Context building ────────────────────────────────────────

  describe("context building", () => {
    it("returns null with insufficient history", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      expect(buildTemporalContext()).toBeNull();
    });

    it("returns null with only one interaction", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction();
      expect(buildTemporalContext()).toBeNull();
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("persists and restores state across restarts", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction();
      recordInteraction();
      recordInteraction();
      const totalBefore = getTemporalAwarenessStats().totalInteractions;

      stopTemporalAwareness();

      // Re-init
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      const totalAfter = getTemporalAwarenessStats().totalInteractions;

      expect(totalAfter).toBe(totalBefore);
    });

    it("preserves typical gap across restarts", () => {
      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      recordInteraction();
      recordInteraction();
      const gapBefore = getTemporalAwarenessStats().typicalGapMs;

      stopTemporalAwareness();

      initTemporalAwareness(tempDir, DEFAULT_CONFIG, undefined);
      const gapAfter = getTemporalAwarenessStats().typicalGapMs;

      expect(gapAfter).toBeCloseTo(gapBefore, 5);
    });
  });
});
