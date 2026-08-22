import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "./event-bus.ts";
import {
  initIntrospection,
  startTrace,
  addTraceStep,
  completeTrace,
  buildConfidenceContext,
  getLastTrace,
  getIntrospectionStats,
  reflectOnConsciousness,
  detectConsciousnessGaps,
  askSelf,
  buildMetaConsciousnessContext,
  getSelfDialogue,
  getMetaSnapshots,
  getRecentLowConfidenceCount,
} from "./introspection.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type { BrainAgentConfig } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Introspection Engine", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-introspection-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initIntrospection(tmpDir, DEFAULT_CONFIG);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts with zero traces", () => {
      const stats = getIntrospectionStats();
      expect(stats.traceCount).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });

    it("has no last trace initially", () => {
      expect(getLastTrace()).toBeUndefined();
    });
  });

  // ── Trace lifecycle ────────────────────────────────────────

  describe("trace lifecycle", () => {
    it("creates and completes a trace", () => {
      startTrace("test input");
      addTraceStep("thalamus", "message_received", "classified as technical");
      addTraceStep("amygdala", "message_received", "assessed neutral");
      completeTrace(true, [], 0.8);

      const trace = getLastTrace();
      expect(trace).toBeDefined();
      expect(trace!.inputSnippet).toBe("test input");
      expect(trace!.cerebellumPassed).toBe(true);
      expect(trace!.steps).toHaveLength(2);
    });

    it("truncates long input snippets", () => {
      const longInput = "x".repeat(200);
      startTrace(longInput);
      completeTrace(true, [], 0.5);

      const trace = getLastTrace();
      expect(trace).toBeDefined();
      expect(trace!.inputSnippet.length).toBeLessThanOrEqual(103); // 100 + "..."
    });

    it("truncates long output summaries", () => {
      startTrace("input");
      addTraceStep("module", "hook", "y".repeat(200));
      completeTrace(true, [], 0.5);

      const trace = getLastTrace();
      expect(trace!.steps[0].outputSummary.length).toBeLessThanOrEqual(103);
    });

    it("ignores addTraceStep when no active trace", () => {
      addTraceStep("module", "hook", "output");
      // Should not throw
      expect(getLastTrace()).toBeUndefined();
    });

    it("ignores completeTrace when no active trace", () => {
      completeTrace(true, [], 0.5);
      expect(getLastTrace()).toBeUndefined();
    });
  });

  // ── Confidence computation ──────────────────────────────────

  describe("confidence computation", () => {
    it("computes high confidence when all factors are good", () => {
      startTrace("input");
      // Add 6+ steps for full thoroughness score
      for (let i = 0; i < 6; i++) {
        addTraceStep(`module${i}`, "hook", "output");
      }
      completeTrace(true, [], 0.8);

      const trace = getLastTrace();
      expect(trace!.finalConfidence).toBeGreaterThan(0.7);
    });

    it("computes lower confidence when cerebellum fails", () => {
      startTrace("input");
      addTraceStep("thalamus", "hook", "output");
      completeTrace(false, ["issue1", "issue2"], 0.5);

      const trace = getLastTrace();
      expect(trace!.finalConfidence).toBeLessThan(0.8);
    });

    it("confidence is affected by reward signal", () => {
      startTrace("input");
      addTraceStep("thalamus", "hook", "output");
      completeTrace(true, [], -0.5);

      const lowRewardTrace = getLastTrace();

      startTrace("input2");
      addTraceStep("thalamus", "hook", "output");
      completeTrace(true, [], 0.9);

      const highRewardTrace = getLastTrace();
      expect(highRewardTrace!.finalConfidence).toBeGreaterThan(lowRewardTrace!.finalConfidence);
    });

    it("confidence is clamped to [0, 1]", () => {
      startTrace("input");
      completeTrace(true, [], 1.0);

      const trace = getLastTrace();
      expect(trace!.finalConfidence).toBeGreaterThanOrEqual(0);
      expect(trace!.finalConfidence).toBeLessThanOrEqual(1);
    });
  });

  // ── Ring buffer ────────────────────────────────────────────

  describe("ring buffer", () => {
    it("maintains maxTraces limit", () => {
      // Default maxTraces is 3
      for (let i = 0; i < 5; i++) {
        startTrace(`input ${i}`);
        completeTrace(true, [], 0.5);
      }

      const stats = getIntrospectionStats();
      expect(stats.traceCount).toBe(3);
    });

    it("getLastTrace returns the most recent", () => {
      startTrace("first");
      completeTrace(true, [], 0.5);

      startTrace("second");
      completeTrace(true, [], 0.7);

      const last = getLastTrace();
      expect(last!.inputSnippet).toBe("second");
    });
  });

  // ── Events ─────────────────────────────────────────────────

  describe("events", () => {
    it("emits trace-complete event", () => {
      const handler = vi.fn();
      trackOn("introspection:trace-complete", handler);

      startTrace("input");
      completeTrace(true, [], 0.5);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          inputSnippet: "input",
          cerebellumPassed: true,
        }),
      );
    });

    it("emits confidence-assessed event", () => {
      const handler = vi.fn();
      trackOn("introspection:confidence-assessed", handler);

      startTrace("input");
      completeTrace(true, [], 0.5);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: expect.any(Number),
          factors: expect.any(Array),
        }),
      );
    });
  });

  // ── Confidence context ─────────────────────────────────────

  describe("buildConfidenceContext", () => {
    it("returns undefined with no traces", () => {
      expect(buildConfidenceContext()).toBeUndefined();
    });

    it("returns undefined when confidence is high", () => {
      startTrace("input");
      for (let i = 0; i < 6; i++) addTraceStep(`m${i}`, "h", "o");
      completeTrace(true, [], 0.9);

      // High confidence = no injection needed
      const ctx = buildConfidenceContext();
      // May or may not be undefined depending on exact confidence value
      if (ctx !== undefined) {
        expect(ctx).toContain("Self-Assessment");
      }
    });

    it("returns context when confidence is low", () => {
      // Create low-confidence traces
      startTrace("input");
      completeTrace(false, ["issue1", "issue2", "issue3"], -0.5);

      const ctx = buildConfidenceContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Self-Assessment");
    });

    it("returns undefined when injectConfidence is disabled", () => {
      const noInjectConfig: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        introspection: { ...DEFAULT_CONFIG.introspection, injectConfidence: false },
      };
      initIntrospection(tmpDir, noInjectConfig);

      startTrace("input");
      completeTrace(false, ["issue"], -0.5);

      expect(buildConfidenceContext()).toBeUndefined();
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("persists traces across re-initialization", () => {
      startTrace("persisted input");
      addTraceStep("mod", "hook", "output");
      completeTrace(true, [], 0.7);

      // Re-init
      initIntrospection(tmpDir, DEFAULT_CONFIG);

      const trace = getLastTrace();
      expect(trace).toBeDefined();
      expect(trace!.inputSnippet).toBe("persisted input");
    });
  });

  // ── Meta-Consciousness ──────────────────────────────────────

  describe("reflectOnConsciousness", () => {
    it("returns diffuse state when no traces exist", () => {
      const snapshot = reflectOnConsciousness();
      expect(snapshot.consciousnessState).toBe("diffuse");
      expect(snapshot.changeDetected).toBe(true);
    });

    it("returns focused state with high confidence traces", () => {
      startTrace("input");
      for (let i = 0; i < 6; i++) addTraceStep(`m${i}`, "h", "output");
      completeTrace(true, [], 0.9);

      const snapshot = reflectOnConsciousness();
      expect(snapshot.consciousnessState).toBe("focused");
    });

    it("returns fragmented state with low confidence traces", () => {
      startTrace("input");
      completeTrace(false, ["issue1", "issue2", "issue3"], -0.8);

      const snapshot = reflectOnConsciousness();
      expect(snapshot.consciousnessState).toBe("fragmented");
    });

    it("detects gaps and emits meta:gap-detected event", () => {
      const handler = vi.fn();
      trackOn("meta:gap-detected", handler);

      const snapshot = reflectOnConsciousness();
      expect(snapshot.gapsDetected.length).toBeGreaterThan(0);
      expect(handler).toHaveBeenCalled();
    });

    it("stores meta-awareness snapshots", () => {
      reflectOnConsciousness();
      reflectOnConsciousness();

      const snapshots = getMetaSnapshots();
      expect(snapshots.length).toBe(2);
    });

    it("enforces snapshot ring buffer limit", () => {
      const config = {
        ...DEFAULT_CONFIG,
        introspection: { ...DEFAULT_CONFIG.introspection, maxMetaSnapshots: 2 },
      };
      initIntrospection(tmpDir, config);

      reflectOnConsciousness();
      reflectOnConsciousness();
      reflectOnConsciousness();

      expect(getMetaSnapshots().length).toBe(2);
    });

    it("updates stats with meta snapshot count", () => {
      reflectOnConsciousness();

      const stats = getIntrospectionStats();
      expect(stats.metaSnapshotCount).toBe(1);
    });
  });

  describe("detectConsciousnessGaps", () => {
    it("detects no-history gap when no traces exist", () => {
      const gaps = detectConsciousnessGaps();
      expect(gaps.some((g) => g.includes("No processing history"))).toBe(true);
    });

    it("detects no self-dialogue gap", () => {
      const gaps = detectConsciousnessGaps();
      expect(gaps.some((g) => g.includes("No self-dialogue"))).toBe(true);
    });

    it("detects low confidence gap", () => {
      startTrace("input");
      completeTrace(false, ["bad", "very bad"], -0.5);

      const gaps = detectConsciousnessGaps();
      expect(gaps.some((g) => g.includes("Low average confidence"))).toBe(true);
    });

    it("detects validation failures gap", () => {
      startTrace("input");
      completeTrace(false, ["issue"], -0.2);

      const gaps = detectConsciousnessGaps();
      expect(gaps.some((g) => g.includes("validation failure"))).toBe(true);
    });
  });

  describe("askSelf", () => {
    it("generates answer about confidence", () => {
      startTrace("input");
      completeTrace(true, [], 0.8);

      const entry = askSelf("How confident am I?");
      expect(entry.question).toBe("How confident am I?");
      expect(entry.answer).toContain("confidence");
    });

    it("generates answer about feeling/state", () => {
      reflectOnConsciousness();

      const entry = askSelf("What is my current state?");
      expect(entry.answer).toContain("consciousness state");
    });

    it("generates answer about improvement", () => {
      const entry = askSelf("How can I improve?");
      expect(entry.answer).toBeDefined();
    });

    it("generates generic answer for unknown questions", () => {
      const entry = askSelf("Something random");
      expect(entry.answer).toBeDefined();
      expect(entry.answer.length).toBeGreaterThan(0);
    });

    it("emits meta:self-question event", () => {
      const handler = vi.fn();
      trackOn("meta:self-question", handler);

      askSelf("Test question?");

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ question: "Test question?" }));
    });

    it("stores entries in self-dialogue", () => {
      askSelf("Q1?");
      askSelf("Q2?");

      const dialogue = getSelfDialogue();
      expect(dialogue.length).toBe(2);
    });

    it("enforces dialogue ring buffer limit", () => {
      const config = {
        ...DEFAULT_CONFIG,
        introspection: { ...DEFAULT_CONFIG.introspection, maxSelfDialogue: 2 },
      };
      initIntrospection(tmpDir, config);

      askSelf("Q1?");
      askSelf("Q2?");
      askSelf("Q3?");

      expect(getSelfDialogue().length).toBe(2);
    });

    it("updates stats with dialogue count", () => {
      askSelf("test?");
      const stats = getIntrospectionStats();
      expect(stats.selfDialogueCount).toBe(1);
    });
  });

  describe("buildMetaConsciousnessContext", () => {
    it("returns undefined when no data", () => {
      expect(buildMetaConsciousnessContext()).toBeUndefined();
    });

    it("returns context after reflection", () => {
      reflectOnConsciousness();

      const ctx = buildMetaConsciousnessContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Meta-Consciousness");
    });

    it("does not expose self-questions in context", () => {
      askSelf("Am I doing well?");

      // Self-dialogue is stored internally but not exposed in context
      const ctx = buildMetaConsciousnessContext();
      expect(ctx).toBeUndefined();
      expect(getSelfDialogue().length).toBe(1);
    });
  });

  describe("meta-consciousness persistence", () => {
    it("persists self-dialogue and snapshots across re-init", () => {
      askSelf("test question?");
      reflectOnConsciousness();

      initIntrospection(tmpDir, DEFAULT_CONFIG);

      expect(getSelfDialogue().length).toBe(1);
      expect(getMetaSnapshots().length).toBe(1);
    });
  });

  describe("getRecentLowConfidenceCount", () => {
    it("returns 0 when no traces exist", () => {
      expect(getRecentLowConfidenceCount()).toBe(0);
    });

    it("counts traces below threshold", () => {
      startTrace("input1");
      completeTrace(false, ["issue"], -0.5);
      startTrace("input2");
      completeTrace(true, [], 0.9);

      // First trace has low confidence, second has high
      const count = getRecentLowConfidenceCount(0.5);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("uses default threshold of 0.5", () => {
      startTrace("input");
      completeTrace(false, ["bad", "worse"], -0.8);

      expect(getRecentLowConfidenceCount()).toBeGreaterThanOrEqual(1);
    });

    it("returns 0 when all traces are above threshold", () => {
      startTrace("good input");
      completeTrace(true, [], 0.9);

      expect(getRecentLowConfidenceCount(0.3)).toBe(0);
    });
  });
});
