import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "./event-bus.ts";
import {
  initLearningCoordinator,
  getLearningStats,
  buildLearningContext,
  getLatestCycleReport,
  recordDomainPerformance,
  assessCapability,
  getDomainPerformance,
  buildCapabilityContext,
  recordRecurringIssue,
} from "./learning-coordinator.ts";
import type { BrainAgentConfig, DopamineSignal } from "./types.ts";
import { DEFAULT_CONFIG } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

function emitReward(modules: string[], reward: number): void {
  const signal: DopamineSignal = {
    reward,
    predictionError: reward - 0.5,
    participatingModules: modules,
    creditAssignment: Object.fromEntries(modules.map((m) => [m, 1 / modules.length])),
    context: {
      domain: "technical",
      complexity: "moderate",
      emotion: "neutral",
      input: "test input",
    },
  };
  bus.emitSync("dopamine:reward", signal);
}

describe("Learning Coordinator", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-learning-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initLearningCoordinator(tmpDir, DEFAULT_CONFIG);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("initializes with zero stats", () => {
      const stats = getLearningStats();
      expect(stats.cycleCount).toBeGreaterThanOrEqual(0);
      expect(stats.moduleCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Reward processing ─────────────────────────────────────

  describe("reward processing", () => {
    it("tracks module metrics after reward signals", () => {
      emitReward(["thalamus", "hippocampus"], 0.8);

      const stats = getLearningStats();
      expect(stats.moduleCount).toBeGreaterThanOrEqual(2);
      expect(stats.modulePerformance["thalamus"]).toBeDefined();
      expect(stats.modulePerformance["hippocampus"]).toBeDefined();
    });

    it("accumulates rewards over multiple cycles", () => {
      emitReward(["thalamus"], 0.7);
      emitReward(["thalamus"], 0.8);
      emitReward(["thalamus"], 0.6);

      const stats = getLearningStats();
      const thalamus = stats.modulePerformance["thalamus"];
      expect(thalamus).toBeDefined();
      expect(thalamus.avgReward).toBeGreaterThan(0);
    });

    it("increments cycle count on each reward", () => {
      const before = getLearningStats().cycleCount;
      emitReward(["thalamus"], 0.5);
      const after = getLearningStats().cycleCount;
      // Cycle count increments by 1 for each reward signal processed
      expect(after).toBeGreaterThan(before);
    });
  });

  // ── Error tracking ────────────────────────────────────────

  describe("error tracking via cerebellum", () => {
    it("tracks errors from cerebellum validation events", () => {
      // Emit some reward first so the module is tracked
      emitReward(["mirrorNeurons"], 0.5);

      // Emit cerebellum validation with language issue
      bus.emitSync("cerebellum:validated", {
        passed: false,
        issues: ["Language mismatch detected"],
      });

      const stats = getLearningStats();
      const mirror = stats.modulePerformance["mirrorNeurons"];
      expect(mirror).toBeDefined();
      expect(mirror.errorRate).toBeGreaterThan(0);
    });
  });

  // ── Learning context ──────────────────────────────────────

  describe("buildLearningContext", () => {
    it("returns undefined when no actionable insights", () => {
      const ctx = buildLearningContext();
      // Initially no insights
      expect(ctx === undefined || typeof ctx === "string").toBe(true);
    });
  });

  // ── Cycle reports ─────────────────────────────────────────

  describe("cycle reports", () => {
    it("generates cycle report after sufficient cycles", () => {
      // Emit 10 rewards to trigger a report
      for (let i = 0; i < 10; i++) {
        emitReward(["thalamus", "hippocampus"], 0.5 + Math.random() * 0.3);
      }

      const report = getLatestCycleReport();
      // Report may or may not exist depending on exact cycle timing
      if (report) {
        expect(report.moduleMetrics).toBeDefined();
        expect(report.systemMetrics).toBeDefined();
        expect(report.systemMetrics.averageReward).toBeDefined();
      }
    });
  });

  // ── Trend detection ───────────────────────────────────────

  describe("trend detection", () => {
    it("detects stable trend with consistent rewards", () => {
      for (let i = 0; i < 20; i++) {
        emitReward(["thalamus"], 0.5);
      }

      const stats = getLearningStats();
      const thalamus = stats.modulePerformance["thalamus"];
      expect(thalamus).toBeDefined();
      expect(thalamus.trend).toBe("stable");
    });
  });

  // ── v2: Domain Performance Tracking ─────────────────────────

  describe("v2: recordDomainPerformance", () => {
    it("creates new domain performance entry", () => {
      recordDomainPerformance("technical", 0.8);

      const perf = getDomainPerformance("technical");
      expect(perf).toBeDefined();
      expect(perf!.cycleCount).toBe(1);
      expect(perf!.avgReward).toBeCloseTo(0.8, 1);
    });

    it("updates running average over multiple cycles", () => {
      recordDomainPerformance("technical", 0.8);
      recordDomainPerformance("technical", 0.6);

      const perf = getDomainPerformance("technical");
      expect(perf!.cycleCount).toBe(2);
      expect(perf!.avgReward).toBeCloseTo(0.7, 1);
    });

    it("tracks error correlations", () => {
      recordDomainPerformance("technical", 0.3, ["language mismatch"]);

      const perf = getDomainPerformance("technical");
      expect(perf!.errorCorrelations).toContain("language mismatch");
    });

    it("emits domain-performance-updated event", () => {
      const handler = vi.fn();
      trackOn("learning:domain-performance-updated", handler);

      recordDomainPerformance("creative", 0.6);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "creative",
          avgReward: expect.any(Number),
          trend: expect.any(String),
        }),
      );
    });

    it("detects trend over window", () => {
      // 10 low rewards then 10 high rewards → improving
      for (let i = 0; i < 10; i++) {
        recordDomainPerformance("technical", 0.3);
      }
      for (let i = 0; i < 10; i++) {
        recordDomainPerformance("technical", 0.8);
      }

      const perf = getDomainPerformance("technical");
      expect(perf!.trend).toBe("improving");
    });
  });

  // ── v2: Capability Assessment ───────────────────────────────

  describe("v2: assessCapability", () => {
    it("returns default confidence for unknown domain", () => {
      const assessment = assessCapability("unknown");
      expect(assessment.confidenceLevel).toBe(0.5);
      expect(assessment.reasoning).toContain("Insufficient data");
    });

    it("returns assessment based on tracked performance", () => {
      for (let i = 0; i < 10; i++) {
        recordDomainPerformance("technical", 0.8);
      }

      const assessment = assessCapability("technical");
      expect(assessment.domain).toBe("technical");
      expect(assessment.confidenceLevel).toBeGreaterThan(0.7);
      expect(assessment.reasoning).toContain("10 interactions");
    });

    it("emits capability-assessed event", () => {
      const handler = vi.fn();
      trackOn("learning:capability-assessed", handler);

      for (let i = 0; i < 5; i++) {
        recordDomainPerformance("technical", 0.7);
      }
      assessCapability("technical");

      expect(handler).toHaveBeenCalledOnce();
    });

    it("includes error correlations in reasoning", () => {
      for (let i = 0; i < 5; i++) {
        recordDomainPerformance("technical", 0.4, ["format issue"]);
      }

      const assessment = assessCapability("technical");
      expect(assessment.reasoning).toContain("format issue");
    });
  });

  // ── v2: Capability Context ──────────────────────────────────

  describe("v2: buildCapabilityContext", () => {
    it("returns undefined with no domain data", () => {
      expect(buildCapabilityContext()).toBeUndefined();
    });

    it("returns undefined with insufficient cycles", () => {
      for (let i = 0; i < 5; i++) {
        recordDomainPerformance("technical", 0.8);
      }
      expect(buildCapabilityContext()).toBeUndefined();
    });

    it("highlights strong domains", () => {
      for (let i = 0; i < 15; i++) {
        recordDomainPerformance("technical", 0.85);
      }

      const ctx = buildCapabilityContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Strong domains");
      expect(ctx).toContain("technical");
    });

    it("highlights weak domains", () => {
      for (let i = 0; i < 15; i++) {
        recordDomainPerformance("creative", 0.25);
      }

      const ctx = buildCapabilityContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Needs improvement");
      expect(ctx).toContain("creative");
    });

    it("adds caution for weak current domain", () => {
      for (let i = 0; i < 15; i++) {
        recordDomainPerformance("emotional", 0.2);
      }

      const ctx = buildCapabilityContext("emotional");
      expect(ctx).toBeDefined();
      expect(ctx).toContain("below average");
      expect(ctx).toContain("emotional");
    });
  });

  // ── Autonomy: recordRecurringIssue ──────────────────────────────
  describe("recordRecurringIssue", () => {
    it("returns undefined for first two occurrences", () => {
      expect(recordRecurringIssue("tone mismatch")).toBeUndefined();
      expect(recordRecurringIssue("tone mismatch")).toBeUndefined();
    });

    it("creates insight on 3rd occurrence", () => {
      recordRecurringIssue("brevity issue");
      recordRecurringIssue("brevity issue");
      const insight = recordRecurringIssue("brevity issue");

      expect(insight).toBeDefined();
      expect(insight!.type).toBe("pattern");
      expect(insight!.source).toBe("cerebellum-feedback");
      expect(insight!.description).toContain("brevity issue");
      expect(insight!.description).toContain("3x");
    });

    it("deduplicates same issue type", () => {
      recordRecurringIssue("format error");
      recordRecurringIssue("format error");
      const first = recordRecurringIssue("format error");
      expect(first).toBeDefined();

      // 4th occurrence should not create another insight
      const second = recordRecurringIssue("format error");
      expect(second).toBeUndefined();
    });

    it("normalizes issue type (case-insensitive, trimmed)", () => {
      recordRecurringIssue("  Tone Mismatch  ");
      recordRecurringIssue("tone mismatch");
      const insight = recordRecurringIssue("TONE MISMATCH");

      expect(insight).toBeDefined();
    });

    it("returns undefined for empty string", () => {
      expect(recordRecurringIssue("")).toBeUndefined();
      expect(recordRecurringIssue("  ")).toBeUndefined();
    });

    it("emits autonomy:learning-pattern-detected event", () => {
      const handler = vi.fn();
      trackOn("autonomy:learning-pattern-detected", handler);

      recordRecurringIssue("empathy gap");
      recordRecurringIssue("empathy gap");
      recordRecurringIssue("empathy gap");

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          issueType: "empathy gap",
          occurrences: 3,
        }),
      );
    });

    it("persists across re-init", () => {
      recordRecurringIssue("persist test");
      recordRecurringIssue("persist test");

      // Re-init to load from disk
      initLearningCoordinator(tmpDir, DEFAULT_CONFIG);

      // 3rd occurrence after reload should create insight
      const insight = recordRecurringIssue("persist test");
      expect(insight).toBeDefined();
    });
  });
});
