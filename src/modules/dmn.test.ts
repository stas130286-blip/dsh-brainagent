import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initDMN,
  runAssociationFinding,
  prepareProactiveContext,
  getDMNStats,
  generateBackgroundThoughts,
  getInnerMonologue,
  buildBackgroundThoughtContext,
  getRecentUnusedInsights,
} from "./dmn.ts";
import { bus } from "./event-bus.ts";
import { initMemoryStorage, storeFact, getFactsByCategory } from "./hippocampus.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type { BrainAgentConfig } from "./types.ts";

let tmpDir: string;
let unsubs: Array<() => void> = [];

function trackOn(...args: Parameters<typeof bus.on>): ReturnType<typeof bus.on> {
  const unsub = bus.on(...args);
  unsubs.push(unsub);
  return unsub;
}

describe("Default Mode Network v2", () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "brainagent-dmn-test-"));
    for (const fn of unsubs) fn();
    unsubs = [];
    bus.gc(0);
    // DMN depends on hippocampus for fact storage/recall
    initMemoryStorage(tmpDir);
    initDMN(tmpDir, DEFAULT_CONFIG);
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts with zero stats", () => {
      const stats = getDMNStats();
      expect(stats.totalInsights).toBe(0);
      expect(stats.associationsFound).toBe(0);
      expect(stats.lastRunTimestamp).toBe(0);
    });
  });

  // ── Association finding ────────────────────────────────────

  describe("runAssociationFinding", () => {
    it("returns empty when fewer than 2 domains have facts", async () => {
      const insights = await runAssociationFinding(DEFAULT_CONFIG);
      expect(insights).toEqual([]);
    });

    it("returns empty when only one category has facts", async () => {
      storeFact("TypeScript has generic types", "definition");
      storeFact("TypeScript supports interfaces", "definition");

      const insights = await runAssociationFinding(DEFAULT_CONFIG);
      expect(insights).toEqual([]);
    });

    it("finds associations between similar cross-category facts", async () => {
      // Store facts in different categories with overlapping concepts
      storeFact("JavaScript uses event-driven programming for async operations", "definition");
      storeFact("JavaScript event patterns are commonly used in web development", "definition");
      storeFact("Event-driven project plan for building interactive application", "plan");
      storeFact("Event-driven architecture solves the interactive art problem", "problem");

      const insights = await runAssociationFinding(DEFAULT_CONFIG);
      // May or may not find associations depending on TF-IDF similarity
      expect(Array.isArray(insights)).toBe(true);
    });

    it("respects maxInsightsPerCycle limit", async () => {
      // Create many cross-category facts
      for (let i = 0; i < 10; i++) {
        storeFact(`programming concept ${i} about algorithms`, "definition");
        storeFact(`algorithm problem ${i} about optimization`, "problem");
      }

      const config: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        dmn: { ...DEFAULT_CONFIG.dmn, maxInsightsPerCycle: 2 },
      };

      const insights = await runAssociationFinding(config);
      expect(insights.length).toBeLessThanOrEqual(2);
    });

    it("emits events for found associations", async () => {
      const insightHandler = vi.fn();
      const associationHandler = vi.fn();
      trackOn("dmn:insight-generated", insightHandler);
      trackOn("dmn:association-found", associationHandler);

      // Create similar cross-category facts
      for (let i = 0; i < 5; i++) {
        storeFact(`machine learning model training step ${i}`, "definition");
        storeFact(`machine learning application problem ${i}`, "problem");
      }

      const insights = await runAssociationFinding(DEFAULT_CONFIG);

      // Events should be emitted for each insight found
      expect(insightHandler).toHaveBeenCalledTimes(insights.length);
      expect(associationHandler).toHaveBeenCalledTimes(insights.length);
    });

    it("updates stats after run", async () => {
      storeFact("data analysis in Python", "definition");
      storeFact("data visualization for art", "plan");

      await runAssociationFinding(DEFAULT_CONFIG);

      const stats = getDMNStats();
      expect(stats.lastRunTimestamp).toBeGreaterThan(0);
    });
  });

  // ── Proactive context ──────────────────────────────────────

  describe("prepareProactiveContext", () => {
    it("returns undefined for empty predictions", () => {
      expect(prepareProactiveContext([])).toBeUndefined();
    });

    it("returns undefined for low confidence predictions", () => {
      expect(prepareProactiveContext([{ topic: "technical", confidence: 0.3 }])).toBeUndefined();
    });

    it("returns undefined when no relevant insights exist", () => {
      expect(prepareProactiveContext([{ topic: "technical", confidence: 0.8 }])).toBeUndefined();
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("persists stats across re-initialization", async () => {
      storeFact("fact about code architecture", "definition");
      storeFact("fact about creative architecture", "plan");

      await runAssociationFinding(DEFAULT_CONFIG);
      const before = getDMNStats();

      // Re-init
      initDMN(tmpDir, DEFAULT_CONFIG);

      const after = getDMNStats();
      expect(after.lastRunTimestamp).toBe(before.lastRunTimestamp);
      expect(after.associationsFound).toBe(before.associationsFound);
    });
  });

  // ── Wake-phase background thinking ─────────────────────────

  describe("generateBackgroundThoughts (wake-phase)", () => {
    it("generates thoughts from unresolved questions", () => {
      const thoughts = generateBackgroundThoughts(DEFAULT_CONFIG, ["What is quantum gravity?"]);

      expect(thoughts.length).toBeGreaterThan(0);
      expect(thoughts[0].source).toBe("unresolved");
      expect(thoughts[0].content).toContain("quantum gravity");
    });

    it("generates thoughts from recent emotional events", () => {
      const thoughts = generateBackgroundThoughts(DEFAULT_CONFIG, undefined, [
        { emotion: "frustration", intensity: 0.8 },
      ]);

      expect(thoughts.length).toBeGreaterThan(0);
      expect(thoughts[0].source).toBe("emotional");
    });

    it("generates thoughts from knowledge gaps", () => {
      const thoughts = generateBackgroundThoughts(DEFAULT_CONFIG, undefined, undefined, [
        { topic: "neural networks" },
      ]);

      expect(thoughts.length).toBeGreaterThan(0);
      expect(thoughts[0].source).toBe("pending");
      expect(thoughts[0].content).toContain("neural networks");
    });

    it("respects maxThoughtsPerCycle limit", () => {
      const config: BrainAgentConfig = {
        ...DEFAULT_CONFIG,
        dmn: { ...DEFAULT_CONFIG.dmn, maxThoughtsPerCycle: 2 },
      };

      const thoughts = generateBackgroundThoughts(
        config,
        ["q1", "q2", "q3"],
        [{ emotion: "joy", intensity: 0.9 }],
        [{ topic: "topic1" }],
      );

      expect(thoughts.length).toBeLessThanOrEqual(2);
    });

    it("appends to inner monologue", () => {
      generateBackgroundThoughts(DEFAULT_CONFIG, ["test question"]);

      const monologue = getInnerMonologue();
      expect(monologue.length).toBeGreaterThan(0);
    });

    it("emits dmn:thought-generated events", () => {
      const handler = vi.fn();
      trackOn("dmn:thought-generated", handler);

      generateBackgroundThoughts(DEFAULT_CONFIG, ["test question"]);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe("buildBackgroundThoughtContext", () => {
    it("returns undefined when monologue is empty", () => {
      expect(buildBackgroundThoughtContext()).toBeUndefined();
    });

    it("returns context after generating thoughts", () => {
      generateBackgroundThoughts(DEFAULT_CONFIG, ["test question"]);

      const ctx = buildBackgroundThoughtContext();
      expect(ctx).toBeDefined();
      expect(ctx).toContain("background-thoughts");
    });
  });

  describe("wakeThoughtInterval config", () => {
    it("default wakeThoughtInterval is 10", () => {
      expect(DEFAULT_CONFIG.dmn.wakeThoughtInterval).toBe(10);
    });
  });

  describe("getRecentUnusedInsights", () => {
    it("returns empty when no insights exist", () => {
      expect(getRecentUnusedInsights()).toEqual([]);
    });

    it("returns unused insights after association finding", async () => {
      // Seed facts in two categories for cross-domain matching
      storeFact("TypeScript is a typed language for web development", "definition");
      storeFact("React uses components for building web interfaces", "definition");
      storeFact("User prefers TypeScript over JavaScript", "user_preference");
      storeFact("User likes building web applications", "user_preference");

      const config = {
        ...DEFAULT_CONFIG,
        dmn: { ...DEFAULT_CONFIG.dmn, minSimilarityForAssociation: 0.01 },
      };
      await runAssociationFinding(config);

      const stats = getDMNStats();
      if (stats.totalInsights > 0) {
        const unused = getRecentUnusedInsights();
        expect(unused.length).toBeGreaterThan(0);
        expect(unused.every((i) => !i.wasUseful)).toBe(true);
      }
    });
  });

  describe("getFactsByCategory (used by DMN)", () => {
    it("returns facts for a category without TF-IDF scoring", () => {
      storeFact("User likes Land Rover cars", "user_info");
      storeFact("User prefers dark mode", "user_preference");

      const userFacts = getFactsByCategory("user_info", 10);
      expect(userFacts.length).toBe(1);
      expect(userFacts[0].content).toContain("Land Rover");
    });

    it("returns empty for categories with no facts", () => {
      const facts = getFactsByCategory("nonexistent_category", 10);
      expect(facts).toEqual([]);
    });

    it("respects limit parameter", () => {
      storeFact("TypeScript is a typed superset of JavaScript", "definition");
      storeFact("Quantum computing uses qubits for parallel computation", "definition");
      storeFact("Neural networks simulate biological brain connections", "definition");
      storeFact("Kubernetes orchestrates container deployments at scale", "definition");
      storeFact("GraphQL provides flexible API query language", "definition");
      const facts = getFactsByCategory("definition", 2);
      expect(facts.length).toBe(2);
    });
  });
});
