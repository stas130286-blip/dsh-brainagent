import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bus } from "./event-bus.ts";
import {
  initSessionBridge,
  recordCycleForSession,
  checkSessionGap,
  buildSessionBridgeContext,
  forceSessionEnd,
  getSessionBridgeStats,
} from "./session-bridge.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type { BrainAgentConfig, ThalamusClassification, AmygdalaAssessment } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

/** Config with a very short gap threshold for testing */
function shortGapConfig(): BrainAgentConfig {
  return {
    ...DEFAULT_CONFIG,
    sessionBridge: {
      ...DEFAULT_CONFIG.sessionBridge,
      gapThresholdMs: 50, // 50ms gap for fast tests
    },
  };
}

function makeClassification(domain = "technical"): ThalamusClassification {
  return {
    modality: "text",
    domain: domain as ThalamusClassification["domain"],
    complexity: "moderate",
    intentSummary: "",
    confidence: 0.9,
    processingPath: "fast",
  };
}

function makeAssessment(emotion = "neutral", intensity = 0.2): AmygdalaAssessment {
  return {
    urgency: 0.3,
    importance: 0.5,
    emotion: emotion as AmygdalaAssessment["emotion"],
    emotionIntensity: intensity,
    empathyNeeded: false,
    rationale: "test",
  };
}

describe("Cross-Session Context Bridge", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-session-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    initSessionBridge(tmpDir, DEFAULT_CONFIG);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts with zero cycles and no gap detected", () => {
      const stats = getSessionBridgeStats();
      expect(stats.currentCycles).toBe(0);
      expect(stats.gapDetected).toBe(false);
      expect(stats.lastSessionTopics).toEqual([]);
    });
  });

  // ── Recording cycles ───────────────────────────────────────

  describe("recordCycleForSession", () => {
    it("increments cycle count", () => {
      recordCycleForSession("hello");
      expect(getSessionBridgeStats().currentCycles).toBe(1);
    });

    it("tracks domain topics from classification", () => {
      recordCycleForSession("question", makeClassification("technical"));
      recordCycleForSession("another", makeClassification("creative"));
      expect(getSessionBridgeStats().currentCycles).toBe(2);
    });

    it("detects questions in input", () => {
      recordCycleForSession("how does this work?");
      // Just verify it doesn't crash; questions are tracked internally
      expect(getSessionBridgeStats().currentCycles).toBe(1);
    });

    it("truncates long input", () => {
      const longInput = "x".repeat(300);
      recordCycleForSession(longInput);
      expect(getSessionBridgeStats().currentCycles).toBe(1);
    });

    it("accumulates reward", () => {
      recordCycleForSession("test", undefined, undefined, 0.8);
      recordCycleForSession("test2", undefined, undefined, 0.6);
      expect(getSessionBridgeStats().currentCycles).toBe(2);
    });
  });

  // ── Gap detection ──────────────────────────────────────────

  describe("checkSessionGap", () => {
    it("returns undefined when no gap", () => {
      recordCycleForSession("hello");
      const result = checkSessionGap();
      expect(result).toBeUndefined();
    });

    it("returns undefined when no cycles recorded", () => {
      // Even with a huge gap, 0 cycles = no session to summarize
      const result = checkSessionGap();
      expect(result).toBeUndefined();
    });

    it("detects gap and creates summary", async () => {
      // Use short gap config
      initSessionBridge(tmpDir, shortGapConfig());

      recordCycleForSession("hello", makeClassification("technical"));
      recordCycleForSession(
        "how?",
        makeClassification("technical"),
        makeAssessment("curiosity", 0.6),
      );

      // Wait for gap threshold
      await new Promise((resolve) => setTimeout(resolve, 80));

      const summary = checkSessionGap();
      expect(summary).toBeDefined();
      expect(summary!.cycleCount).toBe(2);
      expect(summary!.topicsDiscussed).toContain("technical");
    });

    it("emits session events on gap detection", async () => {
      initSessionBridge(tmpDir, shortGapConfig());

      const summaryHandler = vi.fn();
      const resumedHandler = vi.fn();
      trackOn("session:summary-created", summaryHandler);
      trackOn("session:resumed", resumedHandler);

      recordCycleForSession("test");
      await new Promise((resolve) => setTimeout(resolve, 80));
      checkSessionGap();

      expect(summaryHandler).toHaveBeenCalledOnce();
      expect(resumedHandler).toHaveBeenCalledOnce();
    });

    it("resets current session after gap", async () => {
      initSessionBridge(tmpDir, shortGapConfig());

      recordCycleForSession("test");
      await new Promise((resolve) => setTimeout(resolve, 80));
      checkSessionGap();

      expect(getSessionBridgeStats().currentCycles).toBe(0);
    });
  });

  // ── Context building ────────────────────────────────────────

  describe("buildSessionBridgeContext", () => {
    it("returns undefined when no gap detected", () => {
      expect(buildSessionBridgeContext()).toBeUndefined();
    });

    it("returns context after gap detection", async () => {
      initSessionBridge(tmpDir, shortGapConfig());

      recordCycleForSession("original topic", makeClassification("creative"));
      await new Promise((resolve) => setTimeout(resolve, 80));
      checkSessionGap();

      const ctx = buildSessionBridgeContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("Previous Session Context");
      expect(ctx).toContain("creative");
    });

    it("injects only once per gap", async () => {
      initSessionBridge(tmpDir, shortGapConfig());

      recordCycleForSession("test");
      await new Promise((resolve) => setTimeout(resolve, 80));
      checkSessionGap();

      const first = buildSessionBridgeContext();
      const second = buildSessionBridgeContext();
      expect(first).toBeDefined();
      expect(second).toBeUndefined();
    });
  });

  // ── Force session end ──────────────────────────────────────

  describe("forceSessionEnd", () => {
    it("returns undefined when no cycles recorded", () => {
      expect(forceSessionEnd()).toBeUndefined();
    });

    it("creates summary for active session", () => {
      recordCycleForSession("test topic", makeClassification("technical"));

      const summary = forceSessionEnd();
      expect(summary).toBeDefined();
      expect(summary!.cycleCount).toBe(1);
      expect(summary!.topicsDiscussed).toContain("technical");
    });

    it("emits session:summary-created event", () => {
      const handler = vi.fn();
      trackOn("session:summary-created", handler);

      recordCycleForSession("test");
      forceSessionEnd();

      expect(handler).toHaveBeenCalledOnce();
    });

    it("resets session after force end", () => {
      recordCycleForSession("test");
      forceSessionEnd();
      expect(getSessionBridgeStats().currentCycles).toBe(0);
    });
  });

  // ── Summary content ────────────────────────────────────────

  describe("summary content", () => {
    it("includes unresolved questions", async () => {
      initSessionBridge(tmpDir, shortGapConfig());

      recordCycleForSession("how does X work?");
      recordCycleForSession("what about Y?");

      await new Promise((resolve) => setTimeout(resolve, 80));
      const summary = checkSessionGap();

      expect(summary).toBeDefined();
      expect(summary!.unresolvedQuestions.length).toBeGreaterThan(0);
    });

    it("includes emotional arc", async () => {
      initSessionBridge(tmpDir, shortGapConfig());

      recordCycleForSession("angry!", undefined, makeAssessment("anger", 0.8));
      recordCycleForSession("calm now", undefined, makeAssessment("neutral", 0.1));

      await new Promise((resolve) => setTimeout(resolve, 80));
      const summary = checkSessionGap();

      expect(summary).toBeDefined();
      expect(summary!.emotionalArc.length).toBeGreaterThan(0);
    });

    it("sorts topics by frequency", async () => {
      initSessionBridge(tmpDir, shortGapConfig());

      recordCycleForSession("a", makeClassification("technical"));
      recordCycleForSession("b", makeClassification("technical"));
      recordCycleForSession("c", makeClassification("creative"));

      await new Promise((resolve) => setTimeout(resolve, 80));
      const summary = checkSessionGap();

      expect(summary).toBeDefined();
      expect(summary!.topicsDiscussed[0]).toBe("technical");
    });
  });
});
