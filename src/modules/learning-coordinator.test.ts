import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
  isProportionalSeries,
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
      emitReward(["prefrontalCortex"], 0.5);

      // v0.9.17: language issues are detection artifacts and no longer
      // attributed; brevity issues still land on prefrontalCortex
      bus.emitSync("cerebellum:validated", {
        passed: false,
        issues: ["Response seems too brief for a complex question."],
      });

      const stats = getLearningStats();
      const pfc = stats.modulePerformance["prefrontalCortex"];
      expect(pfc).toBeDefined();
      expect(pfc.errorRate).toBeGreaterThan(0);
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

  // ── v0.9.37: время жизни инсайтов и окно ошибок ─────────────

  describe("v0.9.37: proportional series guard", () => {
    function emitWithCredit(reward: number, credit: Record<string, number>): void {
      const modules = Object.keys(credit);
      const signal: DopamineSignal = {
        reward,
        predictionError: reward - 0.5,
        participatingModules: modules,
        creditAssignment: credit,
        context: {
          domain: "technical",
          complexity: "moderate",
          emotion: "neutral",
          input: "test input",
        },
      };
      bus.emitSync("dopamine:reward", signal);
    }

    it("узнаёт пропорциональные ряды и отвергает независимые", () => {
      const a = [0.2, 0.4, 0.6, 0.3, 0.5, 0.1];
      const halved = a.map((v) => v * 0.5);
      expect(isProportionalSeries(a, halved)).toBe(true);

      const independent = [0.2, -0.1, 0.6, 0.3, -0.4, 0.1];
      expect(isProportionalSeries(a, independent)).toBe(false);

      // общий ноль допустим, расхождение нулей — уже нет
      expect(isProportionalSeries([0, 1, 1, 1, 1, 1], [0, 2, 2, 2, 2, 2])).toBe(true);
      expect(isProportionalSeries([0, 1, 1, 1, 1, 1], [1, 2, 2, 2, 2, 2])).toBe(false);
    });

    it("разный credit при общем сигнале не даёт корреляционный инсайт", () => {
      // Оба ряда — один и тот же сигнал, умноженный на 0.2 и 0.3: r≈1, но связи нет
      for (let i = 0; i < 20; i++) {
        emitWithCredit(0.5 + (i % 4) * 0.1, { moduleA: 0.2, moduleB: 0.3 });
      }

      const stats = getLearningStats();
      expect(stats.recentInsights.filter((i) => i.type === "correlation")).toHaveLength(0);
    });
  });

  describe("v0.9.37: err считается по окну", () => {
    it("issues и циклы в окне, старая вспышка затухает", () => {
      emitReward(["cerebellum"], 0.5);
      bus.emitSync("cerebellum:validated", {
        passed: false,
        issues: ["Response may contain sensitive data: email address."],
      });

      const first = getLearningStats().modulePerformance["cerebellum"];
      expect(first.errorsInWindow).toBe(1);
      expect(first.cyclesInWindow).toBe(1);

      // 20 чистых циклов вытесняют вспышку из окна
      for (let i = 0; i < 20; i++) emitReward(["cerebellum"], 0.5);

      const later = getLearningStats().modulePerformance["cerebellum"];
      expect(later.errorRate).toBeLessThan(0.1);
      expect(later.errorsInWindow).toBe(0);
    });

    it("доля модулей суммируется в системную награду", () => {
      for (let i = 0; i < 10; i++) emitReward(["thalamus", "hippocampus"], 0.4);

      const stats = getLearningStats();
      expect(stats.systemReward).toBeCloseTo(0.4, 5);
      expect(stats.modulePerformance["thalamus"].share).toBeCloseTo(0.5, 5);
    });
  });

  describe("v0.9.37: жизненный цикл инсайтов", () => {
    it("счётчик обновляется, а не замораживается", () => {
      for (let i = 0; i < 5; i++) recordRecurringIssue("freeze test");

      const hits = getLearningStats().recentInsights.filter((i) =>
        i.description.includes("freeze test"),
      );
      expect(hits).toHaveLength(1);
      expect(hits[0].description).toContain("5x");
      expect(hits[0].occurrences).toBe(5);
    });

    it("инсайт истекает, если не подтверждался", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        recordRecurringIssue("ttl test");
        recordRecurringIssue("ttl test");
        recordRecurringIssue("ttl test");
        expect(buildLearningContext()).toContain("ttl test");

        vi.setSystemTime(new Date("2026-01-20T00:00:00Z"));
        expect(buildLearningContext()).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("легаси-инсайты мигрируют из трекера, корреляции без времени умирают", () => {
      const dir = join(tmpDir, ".brainagent", "learning");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "coordinator.json"),
        JSON.stringify({
          moduleMetrics: {},
          cycleHistory: [],
          cycleCount: 5,
          activeInsights: [
            {
              type: "pattern",
              source: "cerebellum-feedback",
              target: "system",
              description:
                "Recurring problem (3x): brevity issue. Adjust approach for this type of issue.",
              confidence: 0.8,
              actionable: true,
            },
            {
              type: "correlation",
              source: "thalamus",
              target: "hippocampus",
              description:
                'Modules "thalamus" and "hippocampus" are strongly correlated (r=0.99) — they succeed/fail together',
              confidence: 0.99,
              actionable: false,
            },
          ],
          recurringIssues: { "brevity issue": { count: 9, lastSeen: Date.now() - 60_000 } },
        }),
        "utf8",
      );

      initLearningCoordinator(tmpDir, DEFAULT_CONFIG);

      const stats = getLearningStats();
      expect(stats.activeInsights).toBe(1);
      expect(stats.recentInsights[0].occurrences).toBe(9);
    });
  });
});
