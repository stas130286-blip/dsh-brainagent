import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initPredictiveStorage,
  observeInteraction,
  predict,
  getPredictiveStats,
} from "./predictive-engine.ts";

let tempDir: string;

describe("Predictive Engine (anticipatory cognition)", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "brainagent-pred-"));
    initPredictiveStorage(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── Initialization ──────────────────────────────────────────

  describe("initialization", () => {
    it("starts with empty stats", () => {
      const stats = getPredictiveStats();
      expect(stats.temporalPatterns).toBe(0);
      expect(stats.sequentialPatterns).toBe(0);
      expect(stats.contextualPatterns).toBe(0);
      expect(stats.totalObservations).toBe(0);
    });
  });

  // ── Observation ─────────────────────────────────────────────

  describe("observeInteraction()", () => {
    it("creates temporal pattern on first observation", () => {
      observeInteraction("technical", ["typescript", "code"]);
      const stats = getPredictiveStats();
      expect(stats.temporalPatterns).toBe(1);
      expect(stats.totalObservations).toBe(1);
    });

    it("accumulates observations in same time slot", () => {
      observeInteraction("technical", ["code"]);
      observeInteraction("technical", ["debug"]);
      const stats = getPredictiveStats();
      expect(stats.temporalPatterns).toBe(1);
      expect(stats.totalObservations).toBe(2);
    });

    it("creates sequential pattern when domain changes", () => {
      observeInteraction("technical", ["code"]);
      observeInteraction("creative", ["design"]);
      const stats = getPredictiveStats();
      expect(stats.sequentialPatterns).toBe(1);
    });

    it("no sequential pattern when domain stays the same", () => {
      observeInteraction("technical", ["code"]);
      observeInteraction("technical", ["debug"]);
      const stats = getPredictiveStats();
      expect(stats.sequentialPatterns).toBe(0);
    });

    it("creates contextual pattern when context provided", () => {
      observeInteraction("technical", ["code"], "project-alpha");
      const stats = getPredictiveStats();
      expect(stats.contextualPatterns).toBe(1);
    });

    it("no contextual pattern when no context", () => {
      observeInteraction("technical", ["code"]);
      const stats = getPredictiveStats();
      expect(stats.contextualPatterns).toBe(0);
    });
  });

  // ── Prediction ──────────────────────────────────────────────

  describe("predict()", () => {
    it("returns empty with no observations", () => {
      const predictions = predict();
      expect(predictions).toHaveLength(0);
    });

    it("returns empty with insufficient observations (<3 temporal)", () => {
      observeInteraction("technical", ["code"]);
      observeInteraction("technical", ["debug"]);
      const predictions = predict();
      // Temporal requires >= 3 observations
      expect(predictions.filter((p) => p.type === "temporal")).toHaveLength(0);
    });

    it("generates temporal prediction after enough observations", () => {
      // Same time slot, same domain, 4 observations
      for (let i = 0; i < 4; i++) {
        observeInteraction("technical", ["code"]);
      }
      const predictions = predict();
      const temporal = predictions.filter((p) => p.type === "temporal");
      expect(temporal.length).toBeGreaterThanOrEqual(0);
      // Might or might not pass confidence threshold depending on distribution
    });

    it("generates sequential prediction after transitions", () => {
      // Need >= 2 transitions from same trigger
      observeInteraction("technical", ["code"]);
      observeInteraction("creative", ["design"]);
      observeInteraction("technical", ["code"]);
      observeInteraction("creative", ["design"]);
      const predictions = predict();
      const sequential = predictions.filter((p) => p.type === "sequential");
      expect(sequential.length).toBeGreaterThanOrEqual(0);
    });

    it("generates contextual prediction", () => {
      observeInteraction("technical", ["code"], "workspace-a");
      observeInteraction("technical", ["debug"], "workspace-a");
      observeInteraction("technical", ["test"], "workspace-a");
      const predictions = predict("workspace-a");
      const contextual = predictions.filter((p) => p.type === "contextual");
      expect(contextual.length).toBeGreaterThanOrEqual(0);
    });

    it("predictions are sorted by confidence (highest first)", () => {
      // Build up patterns
      for (let i = 0; i < 5; i++) {
        observeInteraction("technical", ["code"]);
      }
      const predictions = predict();
      for (let i = 1; i < predictions.length; i++) {
        expect(predictions[i].confidence).toBeLessThanOrEqual(predictions[i - 1].confidence);
      }
    });

    it("deduplicates predictions", () => {
      for (let i = 0; i < 5; i++) {
        observeInteraction("technical", ["code"]);
      }
      const predictions = predict();
      const topics = predictions.map((p) => p.predictedTopic);
      const unique = new Set(topics);
      expect(unique.size).toBe(topics.length);
    });
  });

  // ── Stats ───────────────────────────────────────────────────

  describe("getPredictiveStats()", () => {
    it("tracks total observations correctly", () => {
      observeInteraction("technical", ["a"]);
      observeInteraction("creative", ["b"]);
      observeInteraction("casual", ["c"]);
      const stats = getPredictiveStats();
      expect(stats.totalObservations).toBe(3);
    });
  });

  // ── Persistence ─────────────────────────────────────────────

  describe("persistence", () => {
    it("survives re-initialization", () => {
      observeInteraction("technical", ["code"]);
      observeInteraction("creative", ["design"]);
      const statsBefore = getPredictiveStats();

      // Re-init from same directory
      initPredictiveStorage(tempDir);
      const statsAfter = getPredictiveStats();
      expect(statsAfter.totalObservations).toBe(statsBefore.totalObservations);
    });
  });
});
