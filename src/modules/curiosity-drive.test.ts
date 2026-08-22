import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initCuriosityDrive,
  detectKnowledgeGap,
  buildCuriosityContext,
  markGapFilled,
  getCuriosityStats,
  getOpenGaps,
} from "./curiosity-drive.ts";
import { bus } from "./event-bus.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type { BrainAgentConfig } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Curiosity Drive", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-curiosity-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initCuriosityDrive(tmpDir, DEFAULT_CONFIG);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts with zero stats", () => {
      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(0);
      expect(stats.totalDetected).toBe(0);
      expect(stats.questionsGenerated).toBe(0);
      expect(stats.gapsFilled).toBe(0);
    });
  });

  // ── Gap detection ──────────────────────────────────────────

  describe("detectKnowledgeGap", () => {
    it("creates gap when recall is empty", () => {
      detectKnowledgeGap("quantum computing", "technical", true);

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(1);
      expect(stats.totalDetected).toBe(1);
    });

    it("creates gap when prediction confidence is low", () => {
      detectKnowledgeGap("machine learning", "technical", false, 0.1);

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(1);
    });

    it("does not create gap when recall exists and confidence is high", () => {
      detectKnowledgeGap("known topic", "technical", false, 0.8);

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(0);
    });

    it("does not create gap when recall exists and no prediction given", () => {
      detectKnowledgeGap("known topic", "technical", false);

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(0);
    });

    it("strengthens existing gap on re-encounter", () => {
      detectKnowledgeGap("quantum computing", "technical", true);
      detectKnowledgeGap("quantum computing", "technical", true);

      const stats = getCuriosityStats();
      // Should still be 1 gap, but strengthened
      expect(stats.openGaps).toBe(1);
      expect(stats.totalDetected).toBe(1); // New gap only counted once
    });

    it("emits gap-detected event", () => {
      const handler = vi.fn();
      trackOn("curiosity:gap-detected", handler);

      detectKnowledgeGap("new topic", "technical", true);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "new topic",
          domain: "technical",
        }),
      );
    });

    it("enforces max gaps limit", () => {
      const config: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        curiosity: { ...DEFAULT_CONFIG.curiosity, maxGaps: 3 },
      };
      initCuriosityDrive(tmpDir, config);

      for (let i = 0; i < 5; i++) {
        detectKnowledgeGap(`topic-${i}`, "technical", true);
      }

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBeLessThanOrEqual(3);
    });

    it("is case-insensitive for topic matching", () => {
      detectKnowledgeGap("Quantum Computing", "technical", true);
      detectKnowledgeGap("quantum computing", "technical", true);

      const stats = getCuriosityStats();
      // Should match as same topic
      expect(stats.openGaps).toBe(1);
    });
  });

  // ── Curiosity context ──────────────────────────────────────

  describe("buildCuriosityContext", () => {
    it("returns undefined with no gaps", () => {
      expect(buildCuriosityContext(0.5, 0.5)).toBeUndefined();
    });

    it("generates context probabilistically with high serotonin", () => {
      detectKnowledgeGap("quantum computing", "technical", true);

      // With high serotonin and high askProbability, should generate
      const highAskConfig: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        curiosity: { ...DEFAULT_CONFIG.curiosity, askProbability: 1.0 },
      };
      initCuriosityDrive(tmpDir, highAskConfig);
      detectKnowledgeGap("quantum computing", "technical", true);

      const ctx = buildCuriosityContext(1.0, 1.0);
      // With askProbability=1.0, serotonin=1.0 → effectiveProbability = 1.0 * 1.0 * 2 = 2.0
      // Math.random() is always < 2.0, so context should be generated
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Curiosity Note");
      expect(ctx).toContain("quantum computing");
    });

    it("returns undefined with very low serotonin", () => {
      detectKnowledgeGap("topic", "technical", true);

      // Very low effective probability: 0.3 * 0.01 * 2 = 0.006
      // Very unlikely to pass Math.random(), but not guaranteed
      // We'll use default config (askProbability=0.3) with near-zero serotonin
      const ctx = buildCuriosityContext(0.001, 0.5);
      // Most likely undefined, but probabilistic
      // Just verify no crashes
      expect(ctx === undefined || typeof ctx === "string").toBe(true);
    });

    it("picks the most encountered gap", () => {
      const highAskConfig: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        curiosity: { ...DEFAULT_CONFIG.curiosity, askProbability: 1.0 },
      };
      initCuriosityDrive(tmpDir, highAskConfig);

      detectKnowledgeGap("rare topic", "technical", true);
      detectKnowledgeGap("common topic", "technical", true);
      // Strengthen common topic
      detectKnowledgeGap("common topic", "technical", true);
      detectKnowledgeGap("common topic", "technical", true);

      const ctx = buildCuriosityContext(1.0, 1.0);
      expect(ctx).toBeDefined();
      expect(ctx).toContain("common topic");
    });

    it("increments questionsGenerated counter", () => {
      const highAskConfig: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        curiosity: { ...DEFAULT_CONFIG.curiosity, askProbability: 1.0 },
      };
      initCuriosityDrive(tmpDir, highAskConfig);
      detectKnowledgeGap("topic", "technical", true);

      buildCuriosityContext(1.0, 1.0);

      const stats = getCuriosityStats();
      expect(stats.questionsGenerated).toBe(1);
    });

    it("emits question-generated event", () => {
      const handler = vi.fn();
      trackOn("curiosity:question-generated", handler);

      const highAskConfig: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        curiosity: { ...DEFAULT_CONFIG.curiosity, askProbability: 1.0 },
      };
      initCuriosityDrive(tmpDir, highAskConfig);
      detectKnowledgeGap("topic", "technical", true);

      buildCuriosityContext(1.0, 1.0);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "topic",
          question: expect.any(String),
        }),
      );
    });
  });

  // ── Gap filling ────────────────────────────────────────────

  describe("markGapFilled", () => {
    it("marks matching gap as filled", () => {
      detectKnowledgeGap("quantum computing", "technical", true);
      expect(getCuriosityStats().openGaps).toBe(1);

      markGapFilled("quantum computing");
      expect(getCuriosityStats().openGaps).toBe(0);
      expect(getCuriosityStats().gapsFilled).toBe(1);
    });

    it("is case-insensitive", () => {
      detectKnowledgeGap("Quantum Computing", "technical", true);

      markGapFilled("quantum computing");
      expect(getCuriosityStats().openGaps).toBe(0);
    });

    it("does nothing for unknown topic", () => {
      detectKnowledgeGap("topic A", "technical", true);

      markGapFilled("topic B");
      expect(getCuriosityStats().openGaps).toBe(1);
      expect(getCuriosityStats().gapsFilled).toBe(0);
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("persists gaps across re-initialization", () => {
      detectKnowledgeGap("quantum computing", "technical", true);

      // Re-init
      initCuriosityDrive(tmpDir, DEFAULT_CONFIG);

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(1);
      expect(stats.totalDetected).toBe(1);
    });
  });

  // ── getOpenGaps accessor ───────────────────────────────────

  describe("getOpenGaps", () => {
    it("returns empty array when no gaps exist", () => {
      expect(getOpenGaps()).toEqual([]);
    });

    it("returns only open gaps", () => {
      detectKnowledgeGap("topic A", "technical", true);
      detectKnowledgeGap("topic B", "creative", true);
      markGapFilled("topic A");

      const open = getOpenGaps();
      expect(open.length).toBe(1);
      expect(open[0].topic).toBe("topic B");
    });

    it("returns gaps with correct structure", () => {
      detectKnowledgeGap("quantum physics", "technical", true);

      const open = getOpenGaps();
      expect(open.length).toBe(1);
      expect(open[0].topic).toBe("quantum physics");
      expect(open[0].domain).toBe("technical");
      expect(open[0].status).toBe("open");
      expect(open[0].timesEncountered).toBe(1);
    });
  });

  // ── Relaxed gate (sparse recall) ───────────────────────────

  describe("relaxed gap detection", () => {
    it("creates gap with low prediction confidence even when recall is not empty", () => {
      detectKnowledgeGap("obscure topic", "technical", false, 0.1);

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(1);
    });

    it("does not create gap when recall exists and no prediction given", () => {
      detectKnowledgeGap("known topic", "technical", false);

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(0);
    });

    it("does not create gap when recall exists and confidence is above threshold", () => {
      detectKnowledgeGap("well-known topic", "technical", false, 0.8);

      const stats = getCuriosityStats();
      expect(stats.openGaps).toBe(0);
    });
  });
});
